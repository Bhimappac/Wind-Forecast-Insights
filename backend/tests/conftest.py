from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import pytest

from app.services.data_store import DataStore

LONDON_TZ = ZoneInfo("Europe/London")


@pytest.fixture
def sample_times():
    """Generates a sequence of half-hour intervals for Jan 15 2026."""
    base = datetime(2026, 1, 15, 0, 0, tzinfo=UTC)
    return [base + timedelta(minutes=30 * i) for i in range(48)]


@pytest.fixture
def mock_store(tmp_path):
    """Creates a mock DataStore populated with deterministic fixture data."""
    store = DataStore(data_dir=str(tmp_path))

    # Create 48 actuals for 2026-01-15: base sinusoidal generation ~10,000 MW
    actuals = []
    base_target = datetime(2026, 1, 15, 0, 0, tzinfo=UTC)
    for i in range(48):
        t = base_target + timedelta(minutes=30 * i)
        # Synthetic generation between 8000 and 14000 MW
        gen = 10000.0 + 2000.0 * (i % 8) / 8.0
        actuals.append(
            {
                "startTime": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishTime": (t + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "startTime_uk": t.astimezone(LONDON_TZ).strftime("%Y-%m-%d %H:%M:%S"),
                "settlementDate": "2026-01-15",
                "settlementPeriod": i + 1,
                "generation": gen,
            }
        )
    df_act = pd.DataFrame(actuals)

    # Create forecasts published at multiple vintages:
    # 1. Early forecast: D-2 at 18:00 (horizon ~30-54h)
    # 2. Decision time forecast: D-1 at 07:30 (horizon ~16.5-40h) -> Should be picked at 09:00 D-1!
    # 3. Post-decision forecast: D-1 at 11:30 (horizon ~12.5-36h) -> Should NOT be picked if cutoff is 09:00!
    # 4. Intraday forecast: D at 02:30
    forecasts = []
    pub_times = [
        datetime(2026, 1, 13, 18, 0, tzinfo=UTC),  # D-2 18:00
        datetime(2026, 1, 14, 7, 30, tzinfo=UTC),  # D-1 07:30 (before 09:00 cutoff)
        datetime(2026, 1, 14, 11, 30, tzinfo=UTC),  # D-1 11:30 (after 09:00 cutoff)
        datetime(2026, 1, 15, 2, 30, tzinfo=UTC),  # D 02:30
    ]

    for pt in pub_times:
        for i in range(48):
            t = base_target + timedelta(minutes=30 * i)
            # Forecast differs slightly per vintage:
            # D-1 07:30 has +500 MW bias
            offset = 500.0 if pt.hour == 7 else (1200.0 if pt.hour == 18 else -300.0)
            actual_gen = 10000.0 + 2000.0 * (i % 8) / 8.0
            fc_gen = actual_gen + offset
            horizon = (t - pt).total_seconds() / 3600.0
            forecasts.append(
                {
                    "startTime": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "publishTime": pt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "startTime_uk": t.astimezone(LONDON_TZ).strftime("%Y-%m-%d %H:%M:%S"),
                    "publishTime_uk": pt.astimezone(LONDON_TZ).strftime("%Y-%m-%d %H:%M:%S"),
                    "generation": fc_gen,
                    "horizon_hours": horizon,
                }
            )
    df_fc = pd.DataFrame(forecasts)

    store.df_actuals = df_act
    store.df_forecasts = df_fc
    store._preprocess_data()
    store._is_loaded = True

    return store
