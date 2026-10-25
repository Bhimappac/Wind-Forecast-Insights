"""
Prefetch January 2026 actuals (FUELHH, fuelType=WIND) and forecasts (WINDFOR)
from the Elexon BMRS API and save to persistent on-disk snapshots (Parquet + JSON).
"""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

LONDON_TZ = ZoneInfo("Europe/London")
BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
os.makedirs(DATA_DIR, exist_ok=True)


def fetch_with_retries(url: str, retries: int = 4, timeout: int = 45):
    """Fetch JSON from Elexon API with exponential backoff retries."""
    headers = {"User-Agent": "WindForecastInsights/1.0", "Accept": "application/json"}
    req = urllib.request.Request(url, headers=headers)
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    data = resp.read().decode("utf-8")
                    return json.loads(data)
                else:
                    print(f"Warning: HTTP {resp.status} on {url}")
        except Exception as e:
            print(f"[Attempt {attempt}/{retries}] Error fetching {url}: {e}")
            if attempt < retries:
                time.sleep(2 * attempt)
            else:
                raise


def prefetch_actuals():
    """Fetch Jan 1-31 2026 FUELHH actuals for WIND in 5-day chunks."""
    print("=== Fetching FUELHH Actuals (Jan 1 to Jan 31 2026) ===")
    start_date = datetime(2026, 1, 1).date()
    end_date = datetime(2026, 1, 31).date()

    all_wind_records = []
    chunk_size = 5  # days per chunk to avoid slow large payloads
    current = start_date

    while current <= end_date:
        chunk_end = min(current + timedelta(days=chunk_size - 1), end_date)
        url = (
            f"{BASE_URL}/datasets/FUELHH/stream"
            f"?settlementDateFrom={current.isoformat()}&settlementDateTo={chunk_end.isoformat()}"
        )
        print(f"Fetching FUELHH {current.isoformat()} to {chunk_end.isoformat()}...")
        try:
            records = fetch_with_retries(url)
            wind_recs = [r for r in records if r.get("fuelType") == "WIND"]
            print(f"  Got {len(records)} total records, {len(wind_recs)} WIND records")
            all_wind_records.extend(wind_recs)
        except Exception as e:
            print(f"Failed chunk {current} to {chunk_end}: {e}")
            raise
        current = chunk_end + timedelta(days=1)
        time.sleep(0.5)

    print(f"Total WIND actuals fetched: {len(all_wind_records)}")

    # Process into clean DataFrame
    df = pd.DataFrame(all_wind_records)
    # Ensure correct columns and data types
    # Expect: dataset, publishTime, startTime, settlementDate, settlementPeriod, fuelType, generation
    df["startTime_utc"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime_utc"] = pd.to_datetime(df["publishTime"], utc=True)
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")

    # Sort and deduplicate by startTime_utc (keep latest publishTime if duplicate)
    df = df.sort_values(by=["startTime_utc", "publishTime_utc"])
    df = df.drop_duplicates(subset=["startTime_utc"], keep="last")

    # Expose UK local time formatted strings
    df["startTime_uk"] = df["startTime_utc"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
    df["startTime_iso"] = df["startTime_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df["publishTime_iso"] = df["publishTime_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Clean output columns
    cols = ["startTime_iso", "publishTime_iso", "startTime_uk", "settlementDate", "settlementPeriod", "generation"]
    clean_df = df[cols].rename(columns={"startTime_iso": "startTime", "publishTime_iso": "publishTime"})
    clean_df = clean_df.reset_index(drop=True)

    parquet_path = os.path.join(DATA_DIR, "snapshot_actuals_jan2026.parquet")
    json_path = os.path.join(DATA_DIR, "snapshot_actuals_jan2026.json")

    clean_df.to_parquet(parquet_path, index=False)
    clean_df.to_json(json_path, orient="records", indent=2)
    print(f"Saved {len(clean_df)} actuals to {parquet_path} and {json_path}")
    return clean_df


def prefetch_forecasts():
    """Fetch WINDFOR forecasts published from Dec 18 2025 to Feb 1 2026 in 3-day chunks."""
    print("\n=== Fetching WINDFOR Forecasts (Dec 18 2025 to Feb 1 2026) ===")
    start_dt = datetime(2025, 12, 18, 0, 0, 0, tzinfo=UTC)
    end_dt = datetime(2026, 2, 1, 0, 0, 0, tzinfo=UTC)

    all_forecast_records = []
    chunk_days = 3
    current = start_dt

    while current < end_dt:
        chunk_end = min(current + timedelta(days=chunk_days), end_dt)
        from_str = current.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ")
        url = f"{BASE_URL}/datasets/WINDFOR/stream?publishDateTimeFrom={from_str}&publishDateTimeTo={to_str}"
        print(f"Fetching WINDFOR published {from_str} to {to_str}...")
        try:
            records = fetch_with_retries(url)
            print(f"  Got {len(records)} forecast records")
            all_forecast_records.extend(records)
        except Exception as e:
            print(f"Failed chunk {from_str} to {to_str}: {e}")
            raise
        current = chunk_end
        time.sleep(0.5)

    print(f"Total WINDFOR records fetched: {len(all_forecast_records)}")

    df = pd.DataFrame(all_forecast_records)
    df["startTime_utc"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime_utc"] = pd.to_datetime(df["publishTime"], utc=True)
    df["generation"] = pd.to_numeric(df["generation"], errors="coerce")

    # Keep only target delivery times in January 2026 (2026-01-01 00:00 to 2026-01-31 23:30)
    jan_start = pd.Timestamp("2026-01-01 00:00:00+00:00")
    jan_end = pd.Timestamp("2026-01-31 23:30:00+00:00")
    df = df[(df["startTime_utc"] >= jan_start) & (df["startTime_utc"] <= jan_end)]

    # Drop duplicates on (startTime_utc, publishTime_utc)
    df = df.sort_values(by=["startTime_utc", "publishTime_utc"])
    df = df.drop_duplicates(subset=["startTime_utc", "publishTime_utc"], keep="last")

    # Calculate horizon in hours: (startTime - publishTime) in hours
    df["horizon_hours"] = (df["startTime_utc"] - df["publishTime_utc"]).dt.total_seconds() / 3600.0

    # Expose UK local time strings
    df["startTime_uk"] = df["startTime_utc"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
    df["publishTime_uk"] = df["publishTime_utc"].dt.tz_convert(LONDON_TZ).dt.strftime("%Y-%m-%d %H:%M:%S")
    df["startTime_iso"] = df["startTime_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df["publishTime_iso"] = df["publishTime_utc"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    cols = ["startTime_iso", "publishTime_iso", "startTime_uk", "publishTime_uk", "generation", "horizon_hours"]
    clean_df = df[cols].rename(columns={"startTime_iso": "startTime", "publishTime_iso": "publishTime"})
    clean_df = clean_df.reset_index(drop=True)

    parquet_path = os.path.join(DATA_DIR, "snapshot_forecasts_jan2026.parquet")
    json_path = os.path.join(DATA_DIR, "snapshot_forecasts_jan2026.json")

    clean_df.to_parquet(parquet_path, index=False)
    clean_df.to_json(json_path, orient="records", indent=2)
    print(f"Saved {len(clean_df)} forecasts to {parquet_path} and {json_path}")
    return clean_df


if __name__ == "__main__":
    t0 = time.time()
    prefetch_actuals()
    prefetch_forecasts()
    print(f"\nAll snapshots successfully created in {time.time() - t0:.2f}s!")
