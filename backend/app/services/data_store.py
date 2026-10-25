import logging
import os
from zoneinfo import ZoneInfo

import pandas as pd

from backend.app.config import settings

logger = logging.getLogger(__name__)
LONDON_TZ = ZoneInfo(settings.timezone)


class DataStore:
    """
    In-memory and snapshot data store for wind generation actuals and forecasts.
    Guarantees millisecond lookups, explicit deduplication, and timezone consistency.
    """

    def __init__(self, data_dir: str | None = None):
        self.data_dir = data_dir or settings.data_dir
        self.df_actuals: pd.DataFrame = pd.DataFrame()
        self.df_forecasts: pd.DataFrame = pd.DataFrame()
        self._is_loaded: bool = False

    def load_snapshots(self) -> tuple[int, int]:
        """Load Parquet or JSON snapshots into memory."""
        actuals_parquet = os.path.join(self.data_dir, "snapshot_actuals_jan2026.parquet")
        actuals_json = os.path.join(self.data_dir, "snapshot_actuals_jan2026.json")
        forecasts_parquet = os.path.join(self.data_dir, "snapshot_forecasts_jan2026.parquet")
        forecasts_json = os.path.join(self.data_dir, "snapshot_forecasts_jan2026.json")

        # Load Actuals
        if os.path.exists(actuals_parquet):
            logger.info("Loading actuals from Parquet snapshot: %s", actuals_parquet)
            self.df_actuals = pd.read_parquet(actuals_parquet)
        elif os.path.exists(actuals_json):
            logger.info("Loading actuals from JSON snapshot: %s", actuals_json)
            self.df_actuals = pd.read_json(actuals_json)
        else:
            logger.warning("No actuals snapshot found in %s", self.data_dir)
            self.df_actuals = pd.DataFrame(
                columns=["startTime", "publishTime", "startTime_uk", "settlementDate", "settlementPeriod", "generation"]
            )

        # Load Forecasts
        if os.path.exists(forecasts_parquet):
            logger.info("Loading forecasts from Parquet snapshot: %s", forecasts_parquet)
            self.df_forecasts = pd.read_parquet(forecasts_parquet)
        elif os.path.exists(forecasts_json):
            logger.info("Loading forecasts from JSON snapshot: %s", forecasts_json)
            self.df_forecasts = pd.read_json(forecasts_json)
        else:
            logger.warning("No forecasts snapshot found in %s", self.data_dir)
            self.df_forecasts = pd.DataFrame(
                columns=["startTime", "publishTime", "startTime_uk", "publishTime_uk", "generation", "horizon_hours"]
            )

        self._preprocess_data()
        self._is_loaded = True
        logger.info(
            "DataStore initialized with %d actuals and %d forecasts",
            len(self.df_actuals),
            len(self.df_forecasts),
        )
        return len(self.df_actuals), len(self.df_forecasts)

    def _preprocess_data(self):
        """Standardize datetime columns and indices for actuals and forecasts."""
        if not self.df_actuals.empty:
            # Ensure timestamps are parsed as UTC
            self.df_actuals["startTime_dt"] = pd.to_datetime(self.df_actuals["startTime"], utc=True)
            if "publishTime" in self.df_actuals.columns:
                self.df_actuals["publishTime_dt"] = pd.to_datetime(self.df_actuals["publishTime"], utc=True)
            self.df_actuals["generation"] = pd.to_numeric(self.df_actuals["generation"], errors="coerce")

            # Deduplicate by startTime_dt (keep latest publishTime)
            if "publishTime_dt" in self.df_actuals.columns:
                self.df_actuals = self.df_actuals.sort_values(by=["startTime_dt", "publishTime_dt"])
            else:
                self.df_actuals = self.df_actuals.sort_values(by=["startTime_dt"])
            self.df_actuals = self.df_actuals.drop_duplicates(subset=["startTime_dt"], keep="last")

            if "startTime_uk" not in self.df_actuals.columns:
                self.df_actuals["startTime_uk"] = (
                    self.df_actuals["startTime_dt"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
                )

        if not self.df_forecasts.empty:
            self.df_forecasts["startTime_dt"] = pd.to_datetime(self.df_forecasts["startTime"], utc=True)
            self.df_forecasts["publishTime_dt"] = pd.to_datetime(self.df_forecasts["publishTime"], utc=True)
            self.df_forecasts["generation"] = pd.to_numeric(self.df_forecasts["generation"], errors="coerce")

            # Recompute exact horizon in hours
            self.df_forecasts["horizon_hours"] = (
                self.df_forecasts["startTime_dt"] - self.df_forecasts["publishTime_dt"]
            ).dt.total_seconds() / 3600.0

            # Deduplicate on (startTime_dt, publishTime_dt)
            self.df_forecasts = self.df_forecasts.sort_values(by=["startTime_dt", "publishTime_dt"])
            self.df_forecasts = self.df_forecasts.drop_duplicates(
                subset=["startTime_dt", "publishTime_dt"], keep="last"
            )

            if "startTime_uk" not in self.df_forecasts.columns:
                self.df_forecasts["startTime_uk"] = (
                    self.df_forecasts["startTime_dt"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
                )
            if "publishTime_uk" not in self.df_forecasts.columns:
                self.df_forecasts["publishTime_uk"] = (
                    self.df_forecasts["publishTime_dt"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
                )

    def get_actuals(self, from_dt: pd.Timestamp | None = None, to_dt: pd.Timestamp | None = None) -> pd.DataFrame:
        if not self._is_loaded:
            self.load_snapshots()
        df = self.df_actuals
        if from_dt is not None:
            df = df[df["startTime_dt"] >= from_dt]
        if to_dt is not None:
            df = df[df["startTime_dt"] <= to_dt]
        return df.copy()

    def get_forecasts(self, from_dt: pd.Timestamp | None = None, to_dt: pd.Timestamp | None = None) -> pd.DataFrame:
        if not self._is_loaded:
            self.load_snapshots()
        df = self.df_forecasts
        if from_dt is not None:
            df = df[df["startTime_dt"] >= from_dt]
        if to_dt is not None:
            df = df[df["startTime_dt"] <= to_dt]
        return df.copy()


# Global singleton instance
data_store = DataStore()
