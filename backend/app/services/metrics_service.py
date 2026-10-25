from typing import Any

import numpy as np
import pandas as pd


class MetricsService:
    """Computes error metrics and distributions for wind forecasts vs actuals."""

    @staticmethod
    def calculate_summary_metrics(
        df_matched: pd.DataFrame,
        from_time: str | None = None,
        to_time: str | None = None,
        min_horizon: float | None = None,
        max_horizon: float | None = None,
    ) -> dict[str, Any]:
        """
        Calculate MAE, RMSE, MAPE, Mean Bias, and absolute error percentiles (P50, P90, P95, P99).
        Guards against zero actuals for MAPE.
        """
        if df_matched.empty or "error" not in df_matched.columns:
            return {
                "sampleCount": 0,
                "mae": None,
                "rmse": None,
                "mape": None,
                "meanBias": None,
                "medianBias": None,
                "p50AbsError": None,
                "p90AbsError": None,
                "p95AbsError": None,
                "p99AbsError": None,
                "maxOverForecast": None,
                "maxUnderForecast": None,
                "fromTime": from_time,
                "toTime": to_time,
                "minHorizonHours": min_horizon,
                "maxHorizonHours": max_horizon,
            }

        errors = df_matched["error"].dropna()
        abs_errors = df_matched["abs_error"].dropna()
        forecasts = df_matched["forecastGeneration"].dropna()
        actuals = df_matched["actualGeneration"].dropna()

        count = len(errors)
        if count == 0:
            return {
                "sampleCount": 0,
                "mae": None,
                "rmse": None,
                "mape": None,
                "meanBias": None,
                "medianBias": None,
                "p50AbsError": None,
                "p90AbsError": None,
                "p95AbsError": None,
                "p99AbsError": None,
                "maxOverForecast": None,
                "maxUnderForecast": None,
                "fromTime": from_time,
                "toTime": to_time,
                "minHorizonHours": min_horizon,
                "maxHorizonHours": max_horizon,
            }

        mae = float(abs_errors.mean())
        rmse = float(np.sqrt((errors**2).mean()))
        mean_bias = float(errors.mean())
        median_bias = float(errors.median())

        # Guard MAPE: actuals clamped to minimum 1.0 MW to avoid division by zero
        clamped_actuals = np.maximum(actuals, 1.0)
        mape = float((abs_errors / clamped_actuals).mean() * 100.0)

        p50 = float(np.percentile(abs_errors, 50))
        p90 = float(np.percentile(abs_errors, 90))
        p95 = float(np.percentile(abs_errors, 95))
        p99 = float(np.percentile(abs_errors, 99))

        max_over = float(errors.max()) if not errors.empty else 0.0
        max_under = float(errors.min()) if not errors.empty else 0.0

        return {
            "sampleCount": count,
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape": round(mape, 2),
            "meanBias": round(mean_bias, 2),
            "medianBias": round(median_bias, 2),
            "p50AbsError": round(p50, 2),
            "p90AbsError": round(p90, 2),
            "p95AbsError": round(p95, 2),
            "p99AbsError": round(p99, 2),
            "maxOverForecast": round(max_over, 2),
            "maxUnderForecast": round(max_under, 2),
            "fromTime": from_time,
            "toTime": to_time,
            "minHorizonHours": min_horizon,
            "maxHorizonHours": max_horizon,
        }

    @staticmethod
    def calculate_by_horizon(df_matched: pd.DataFrame) -> list[dict[str, Any]]:
        """Group metrics by forecast horizon bins (e.g. 0-3h, 3-6h, ... up to 48h+)."""
        if df_matched.empty:
            return []

        # Standard power trading horizon bins
        bins = [
            (0, 3, "0-3h"),
            (3, 6, "3-6h"),
            (6, 12, "6-12h"),
            (12, 18, "12-18h"),
            (18, 24, "18-24h"),
            (24, 30, "24-30h"),
            (30, 36, "30-36h"),
            (36, 42, "36-42h"),
            (42, 48, "42-48h"),
            (48, 72, "48-72h"),
        ]

        result = []
        for low, high, label in bins:
            sub = df_matched[(df_matched["horizonHours"] >= low) & (df_matched["horizonHours"] < high)]
            if len(sub) == 0:
                continue

            errors = sub["error"].dropna()
            abs_errors = sub["abs_error"].dropna()
            actuals = sub["actualGeneration"].dropna()
            clamped_act = np.maximum(actuals, 1.0)

            mae = float(abs_errors.mean())
            rmse = float(np.sqrt((errors**2).mean()))
            mean_bias = float(errors.mean())
            mape = float((abs_errors / clamped_act).mean() * 100.0)
            p50 = float(np.percentile(abs_errors, 50))
            p90 = float(np.percentile(abs_errors, 90))
            p95 = float(np.percentile(abs_errors, 95))

            result.append(
                {
                    "horizonBin": label,
                    "minHorizon": float(low),
                    "maxHorizon": float(high),
                    "sampleCount": len(sub),
                    "avgForecastMw": round(float(sub["forecastGeneration"].mean()), 2),
                    "avgActualMw": round(float(sub["actualGeneration"].mean()), 2),
                    "mae": round(mae, 2),
                    "rmse": round(rmse, 2),
                    "mape": round(mape, 2),
                    "meanBias": round(mean_bias, 2),
                    "p50AbsError": round(p50, 2),
                    "p90AbsError": round(p90, 2),
                    "p95AbsError": round(p95, 2),
                }
            )

        return result

    @staticmethod
    def calculate_by_hour(df_matched: pd.DataFrame) -> list[dict[str, Any]]:
        """Group metrics by UK local hour of day (0 to 23)."""
        if df_matched.empty:
            return []

        df_matched = df_matched.copy()
        if "hourUk" not in df_matched.columns:
            # Parse London hour from startTimeUk
            df_matched["hourUk"] = pd.to_datetime(df_matched["startTimeUk"]).dt.hour

        result = []
        for hour in range(24):
            sub = df_matched[df_matched["hourUk"] == hour]
            if len(sub) == 0:
                continue

            errors = sub["error"].dropna()
            abs_errors = sub["abs_error"].dropna()

            mae = float(abs_errors.mean())
            rmse = float(np.sqrt((errors**2).mean()))
            mean_bias = float(errors.mean())
            p90 = float(np.percentile(abs_errors, 90))

            result.append(
                {
                    "hourUk": hour,
                    "hourLabel": f"{hour:02d}:00",
                    "sampleCount": len(sub),
                    "avgForecastMw": round(float(sub["forecastGeneration"].mean()), 2),
                    "avgActualMw": round(float(sub["actualGeneration"].mean()), 2),
                    "mae": round(mae, 2),
                    "rmse": round(rmse, 2),
                    "meanBias": round(mean_bias, 2),
                    "p90AbsError": round(p90, 2),
                }
            )

        return result

    @staticmethod
    def calculate_by_day(df_matched: pd.DataFrame) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Group metrics by delivery day (YYYY-MM-DD), plus time series."""
        if df_matched.empty:
            return [], []

        df_matched = df_matched.copy()
        if "deliveryDate" not in df_matched.columns:
            df_matched["deliveryDate"] = df_matched["startTimeUk"].str.slice(0, 10)

        daily_list = []
        for d, sub in df_matched.groupby("deliveryDate", sort=True):
            errors = sub["error"].dropna()
            abs_errors = sub["abs_error"].dropna()
            actuals = sub["actualGeneration"].dropna()
            clamped_act = np.maximum(actuals, 1.0)

            mae = float(abs_errors.mean())
            rmse = float(np.sqrt((errors**2).mean()))
            mean_bias = float(errors.mean())
            mape = float((abs_errors / clamped_act).mean() * 100.0)
            p90 = float(np.percentile(abs_errors, 90))

            daily_list.append(
                {
                    "deliveryDate": str(d),
                    "sampleCount": len(sub),
                    "avgForecastMw": round(float(sub["forecastGeneration"].mean()), 2),
                    "avgActualMw": round(float(sub["actualGeneration"].mean()), 2),
                    "mae": round(mae, 2),
                    "rmse": round(rmse, 2),
                    "meanBias": round(mean_bias, 2),
                    "mape": round(mape, 2),
                    "p90AbsError": round(p90, 2),
                }
            )

        # Time series representation
        ts_cols = [
            "startTime",
            "startTimeUk",
            "forecastGeneration",
            "actualGeneration",
            "error",
            "abs_error",
            "horizonHours",
        ]
        ts_sub = df_matched[ts_cols].dropna().sort_values(by="startTime")
        ts_list = []
        for _, row in ts_sub.iterrows():
            ts_list.append(
                {
                    "startTime": row["startTime"],
                    "startTimeUk": row["startTimeUk"],
                    "forecastGeneration": round(float(row["forecastGeneration"]), 1),
                    "actualGeneration": round(float(row["actualGeneration"]), 1),
                    "error": round(float(row["error"]), 1),
                    "absError": round(float(row["abs_error"]), 1),
                    "horizonHours": round(float(row["horizonHours"]), 1),
                }
            )

        return daily_list, ts_list
