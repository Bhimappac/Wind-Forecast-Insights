from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from backend.app.config import settings
from backend.app.services.data_store import data_store

LONDON_TZ = ZoneInfo(settings.timezone)


class ForecastService:
    """Core domain logic for day-ahead decision time forecasts and vintage analysis."""

    def __init__(self):
        self.store = data_store
        self._p90_lookup_cache: dict[str, float] | None = None

    def _get_p90_by_horizon(self) -> dict[str, float]:
        """Precompute and cache historical P90 absolute error by horizon bin across Jan 2026."""
        if self._p90_lookup_cache is not None:
            return self._p90_lookup_cache

        df_act = self.store.get_actuals()
        df_fc = self.store.get_forecasts()

        if df_act.empty or df_fc.empty:
            return {}

        # Merge positive horizon forecasts with actuals
        fc_sub = df_fc[df_fc["horizon_hours"] > 0].copy()
        merged = pd.merge(
            fc_sub,
            df_act[["startTime_dt", "generation"]].rename(columns={"generation": "actual"}),
            on="startTime_dt",
            how="inner",
        )
        if merged.empty:
            return {}

        merged["abs_error"] = (merged["generation"] - merged["actual"]).abs()

        # Group by 6-hour bins
        lookup = {}
        bins = [
            (0, 6, "0-6h"),
            (6, 12, "6-12h"),
            (12, 18, "12-18h"),
            (18, 24, "18-24h"),
            (24, 30, "24-30h"),
            (30, 36, "30-36h"),
            (36, 48, "36-48h"),
            (48, 100, "48h+"),
        ]
        for low, high, label in bins:
            sub = merged[(merged["horizon_hours"] >= low) & (merged["horizon_hours"] < high)]
            if not sub.empty:
                p90 = float(np.percentile(sub["abs_error"], 90))
                lookup[label] = round(p90, 1)
            else:
                lookup[label] = 1500.0  # fallback conservative MW

        self._p90_lookup_cache = lookup
        return lookup

    def _get_p90_for_horizon(self, horizon: float) -> float:
        lookup = self._get_p90_by_horizon()
        if horizon < 6:
            return lookup.get("0-6h", 800.0)
        elif horizon < 12:
            return lookup.get("6-12h", 1200.0)
        elif horizon < 18:
            return lookup.get("12-18h", 1600.0)
        elif horizon < 24:
            return lookup.get("18-24h", 2000.0)
        elif horizon < 30:
            return lookup.get("24-30h", 2300.0)
        elif horizon < 36:
            return lookup.get("30-36h", 2600.0)
        elif horizon < 48:
            return lookup.get("36-48h", 2900.0)
        else:
            return lookup.get("48h+", 3200.0)

    def parse_decision_cutoff(
        self, delivery_date_str: str, decision_time_param: str | None = None
    ) -> tuple[datetime, str, str]:
        """
        Derive the decision cutoff UTC datetime.
        Default: 09:00 UK local time on D-1.
        Supports:
          - None or empty -> D-1 at 09:00 London time
          - "HH:MM" -> D-1 at HH:MM London time
          - Full ISO string -> parsed directly and converted to UTC
        """
        # Parse delivery date
        deliv_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
        d_minus_1 = deliv_date - timedelta(days=1)

        if not decision_time_param or decision_time_param.strip() == "":
            t_hour, t_min = 9, 0
            uk_dt = datetime.combine(d_minus_1, time(t_hour, t_min), tzinfo=LONDON_TZ)
        elif ":" in decision_time_param and len(decision_time_param) <= 8 and "T" not in decision_time_param:
            parts = decision_time_param.split(":")
            t_hour, t_min = int(parts[0]), int(parts[1])
            uk_dt = datetime.combine(d_minus_1, time(t_hour, t_min), tzinfo=LONDON_TZ)
        else:
            # Full ISO timestamp
            parsed = pd.to_datetime(decision_time_param, utc=True).to_pydatetime()
            uk_dt = parsed.astimezone(LONDON_TZ)

        utc_dt = uk_dt.astimezone(ZoneInfo("UTC"))
        decision_time_iso = utc_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        decision_time_uk = uk_dt.strftime("%Y-%m-%d %H:%M:%S")

        return utc_dt, decision_time_iso, decision_time_uk

    def get_latest_forecast_for_delivery_day(
        self, delivery_date_str: str, decision_time_param: str | None = None
    ) -> dict[str, Any]:
        """
        For each half-hour of the delivery day (48 settlement periods), return the most recent forecast
        with publishTime <= decision_time, plus actuals if available.
        """
        cutoff_utc, cutoff_iso, cutoff_uk = self.parse_decision_cutoff(delivery_date_str, decision_time_param)
        cutoff_ts = pd.Timestamp(cutoff_utc)

        # Target range: from 00:00:00 to 23:30:00 on delivery date
        # Delivery date in London time
        deliv_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
        start_day_london = datetime.combine(deliv_date, time(0, 0), tzinfo=LONDON_TZ)
        end_day_london = datetime.combine(deliv_date, time(23, 30), tzinfo=LONDON_TZ)

        start_day_utc = pd.Timestamp(start_day_london.astimezone(ZoneInfo("UTC")))
        end_day_utc = pd.Timestamp(end_day_london.astimezone(ZoneInfo("UTC")))

        # Get relevant forecasts and actuals
        df_fc = self.store.get_forecasts()
        df_act = self.store.get_actuals()

        # Filter forecasts for target intervals in this day and published <= cutoff
        fc_day = df_fc[
            (df_fc["startTime_dt"] >= start_day_utc)
            & (df_fc["startTime_dt"] <= end_day_utc)
            & (df_fc["publishTime_dt"] <= cutoff_ts)
        ].copy()

        # For each target startTime, select the latest publishTime
        fc_latest = fc_day.sort_values(by=["startTime_dt", "publishTime_dt"]).drop_duplicates(
            subset=["startTime_dt"], keep="last"
        )

        # Get actuals for the day
        act_day = df_act[(df_act["startTime_dt"] >= start_day_utc) & (df_act["startTime_dt"] <= end_day_utc)].copy()

        # Build 48 periods grid (every 30 mins)
        periods = []
        cur_dt = start_day_london
        sp_idx = 1
        while cur_dt <= end_day_london:
            cur_utc = cur_dt.astimezone(ZoneInfo("UTC"))
            periods.append(
                {
                    "settlementPeriod": sp_idx,
                    "startTime_dt": pd.Timestamp(cur_utc),
                    "startTime": cur_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "startTimeUk": cur_dt.strftime("%Y-%m-%d %H:%M:%S"),
                }
            )
            cur_dt += timedelta(minutes=30)
            sp_idx += 1

        df_grid = pd.DataFrame(periods)

        # Merge forecasts
        if not fc_latest.empty:
            cols_fc = ["startTime_dt", "generation", "publishTime", "publishTime_uk", "horizon_hours"]
            df_grid = pd.merge(df_grid, fc_latest[cols_fc], on="startTime_dt", how="left")
            df_grid = df_grid.rename(
                columns={
                    "generation": "forecastGeneration",
                    "publishTime_uk": "publishTimeUk",
                    "horizon_hours": "horizonHours",
                }
            )
        else:
            df_grid["forecastGeneration"] = np.nan
            df_grid["publishTime"] = None
            df_grid["publishTimeUk"] = None
            df_grid["horizonHours"] = np.nan

        # Merge actuals
        if not act_day.empty:
            cols_act = ["startTime_dt", "generation"]
            df_grid = pd.merge(df_grid, act_day[cols_act], on="startTime_dt", how="left")
            df_grid = df_grid.rename(columns={"generation": "actualGeneration"})
        else:
            df_grid["actualGeneration"] = np.nan

        # Calculate error and P90 confidence bounds
        df_grid["error"] = df_grid["forecastGeneration"] - df_grid["actualGeneration"]
        df_grid["abs_error"] = df_grid["error"].abs()

        items = []
        forecast_publishes_used = []
        for _, row in df_grid.iterrows():
            fc_val = float(row["forecastGeneration"]) if pd.notnull(row["forecastGeneration"]) else None
            act_val = float(row["actualGeneration"]) if pd.notnull(row["actualGeneration"]) else None
            err_val = float(row["error"]) if pd.notnull(row["error"]) else None
            abs_err = float(row["abs_error"]) if pd.notnull(row["abs_error"]) else None
            horizon = float(row["horizonHours"]) if pd.notnull(row["horizonHours"]) else None

            p90_band = self._get_p90_for_horizon(horizon) if horizon is not None else 2000.0
            lower_p90 = max(0.0, fc_val - p90_band) if fc_val is not None else None
            upper_p90 = (fc_val + p90_band) if fc_val is not None else None

            if pd.notnull(row["publishTime"]):
                forecast_publishes_used.append(str(row["publishTime"]))

            items.append(
                {
                    "startTime": row["startTime"],
                    "startTimeUk": row["startTimeUk"],
                    "settlementPeriod": int(row["settlementPeriod"]),
                    "forecastGeneration": round(fc_val, 1) if fc_val is not None else None,
                    "publishTime": str(row["publishTime"]) if pd.notnull(row["publishTime"]) else None,
                    "publishTimeUk": str(row["publishTimeUk"]) if pd.notnull(row["publishTimeUk"]) else None,
                    "actualGeneration": round(act_val, 1) if act_val is not None else None,
                    "error": round(err_val, 1) if err_val is not None else None,
                    "absError": round(abs_err, 1) if abs_err is not None else None,
                    "horizonHours": round(horizon, 1) if horizon is not None else None,
                    "expectedLowerP90": round(lower_p90, 1) if lower_p90 is not None else None,
                    "expectedUpperP90": round(upper_p90, 1) if upper_p90 is not None else None,
                }
            )

        # KPI computations
        valid_fc = df_grid["forecastGeneration"].dropna()
        valid_act = df_grid["actualGeneration"].dropna()
        valid_err = df_grid["error"].dropna()
        valid_abs_err = df_grid["abs_error"].dropna()

        peak_fc = float(valid_fc.max()) if not valid_fc.empty else None
        min_fc = float(valid_fc.min()) if not valid_fc.empty else None
        avg_fc = float(valid_fc.mean()) if not valid_fc.empty else None
        avg_act = float(valid_act.mean()) if not valid_act.empty else None

        # Peak & min time
        peak_time_uk = None
        min_time_uk = None
        if not valid_fc.empty:
            peak_idx = df_grid["forecastGeneration"].idxmax()
            min_idx = df_grid["forecastGeneration"].idxmin()
            peak_time_uk = df_grid.loc[peak_idx, "startTimeUk"]
            min_time_uk = df_grid.loc[min_idx, "startTimeUk"]

        total_fc_mwh = float(valid_fc.sum() * 0.5) if not valid_fc.empty else None
        total_act_mwh = float(valid_act.sum() * 0.5) if not valid_act.empty else None
        mae_mw = float(valid_abs_err.mean()) if not valid_abs_err.empty else None
        bias_mw = float(valid_err.mean()) if not valid_err.empty else None

        avg_horizon = (
            float(df_grid["horizonHours"].dropna().mean()) if not df_grid["horizonHours"].dropna().empty else 24.0
        )
        expected_p90_band = self._get_p90_for_horizon(avg_horizon)

        latest_pub_used = max(forecast_publishes_used) if forecast_publishes_used else None

        kpis = {
            "deliveryDate": delivery_date_str,
            "decisionTimeUsed": cutoff_iso,
            "decisionTimeUk": cutoff_uk,
            "forecastPublishTimeUsed": latest_pub_used,
            "peakForecastMw": round(peak_fc, 1) if peak_fc is not None else None,
            "peakForecastTimeUk": peak_time_uk,
            "avgForecastMw": round(avg_fc, 1) if avg_fc is not None else None,
            "minForecastMw": round(min_fc, 1) if min_fc is not None else None,
            "minForecastTimeUk": min_time_uk,
            "totalForecastMwh": round(total_fc_mwh, 1) if total_fc_mwh is not None else None,
            "avgActualMw": round(avg_act, 1) if avg_act is not None else None,
            "totalActualMwh": round(total_act_mwh, 1) if total_act_mwh is not None else None,
            "maeMw": round(mae_mw, 1) if mae_mw is not None else None,
            "meanBiasMw": round(bias_mw, 1) if bias_mw is not None else None,
            "expectedP90BandMw": round(expected_p90_band, 1),
        }

        return {
            "deliveryDate": delivery_date_str,
            "decisionTime": cutoff_iso,
            "decisionTimeUk": cutoff_uk,
            "kpis": kpis,
            "data": items,
        }

    def get_forecast_vintages(self, target_time_str: str) -> dict[str, Any]:
        """Return all forecasts published for one target half-hour, to show how forecast evolved."""
        target_ts = pd.to_datetime(target_time_str, utc=True)
        target_iso = target_ts.strftime("%Y-%m-%dT%H:%M:%SZ")
        target_uk = target_ts.tz_convert(LONDON_TZ).strftime("%Y-%m-%d %H:%M:%S")

        df_fc = self.store.get_forecasts()
        df_act = self.store.get_actuals()

        # Find actual for this interval
        act_row = df_act[df_act["startTime_dt"] == target_ts]
        actual_mw = float(act_row["generation"].iloc[0]) if not act_row.empty else None

        # Find all forecast vintages
        vintages_df = df_fc[df_fc["startTime_dt"] == target_ts].sort_values(by="publishTime_dt")

        vintages = []
        for _, row in vintages_df.iterrows():
            fc_mw = float(row["generation"])
            err = (fc_mw - actual_mw) if actual_mw is not None else None
            vintages.append(
                {
                    "publishTime": row["publishTime"],
                    "publishTimeUk": row["publishTime_uk"],
                    "horizonHours": round(float(row["horizon_hours"]), 1),
                    "forecastGeneration": round(fc_mw, 1),
                    "actualGeneration": round(actual_mw, 1) if actual_mw is not None else None,
                    "error": round(err, 1) if err is not None else None,
                }
            )

        return {
            "targetTime": target_iso,
            "targetTimeUk": target_uk,
            "actualGeneration": round(actual_mw, 1) if actual_mw is not None else None,
            "totalVintages": len(vintages),
            "vintages": vintages,
        }

    def get_matched_forecasts_and_actuals(
        self,
        from_time: str | None = None,
        to_time: str | None = None,
        min_horizon: float | None = None,
        max_horizon: float | None = None,
        decision_time_only: bool = False,
    ) -> pd.DataFrame:
        """
        Produce a matched DataFrame of forecasts and actuals with error metrics,
        filtered by time window and horizon range.
        """
        df_act = self.store.get_actuals()
        df_fc = self.store.get_forecasts()

        if df_act.empty or df_fc.empty:
            return pd.DataFrame()

        # Filter forward forecasts: default only positive horizons (>0h)
        fc_sub = df_fc[df_fc["horizon_hours"] > 0].copy()

        if from_time:
            from_ts = pd.to_datetime(from_time, utc=True)
            fc_sub = fc_sub[fc_sub["startTime_dt"] >= from_ts]
        if to_time:
            to_ts = pd.to_datetime(to_time, utc=True)
            fc_sub = fc_sub[fc_sub["startTime_dt"] <= to_ts]

        if min_horizon is not None:
            fc_sub = fc_sub[fc_sub["horizon_hours"] >= float(min_horizon)]
        if max_horizon is not None:
            fc_sub = fc_sub[fc_sub["horizon_hours"] <= float(max_horizon)]

        # Merge on startTime_dt
        act_cols = ["startTime_dt", "generation", "startTime_uk", "settlementDate", "settlementPeriod"]
        merged = pd.merge(
            fc_sub,
            df_act[act_cols].rename(columns={"generation": "actualGeneration"}),
            on="startTime_dt",
            how="inner",
        )

        merged = merged.rename(
            columns={
                "generation": "forecastGeneration",
                "horizon_hours": "horizonHours",
                "startTime_uk_x": "startTimeUk",
            }
        )
        if "startTimeUk" not in merged.columns and "startTime_uk" in merged.columns:
            merged["startTimeUk"] = merged["startTime_uk"]

        merged["error"] = merged["forecastGeneration"] - merged["actualGeneration"]
        merged["abs_error"] = merged["error"].abs()

        return merged


# Global service instance
forecast_service = ForecastService()
