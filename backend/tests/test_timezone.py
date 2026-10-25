from zoneinfo import ZoneInfo

from backend.app.services.forecast_service import ForecastService

LONDON_TZ = ZoneInfo("Europe/London")


def test_london_timezone_normalization():
    """Verify timestamps are normalized to UTC and mapped to Europe/London."""
    svc = ForecastService()

    # Jan 15 2026: UK is on GMT (UTC+0)
    utc_dt, iso_str, uk_str = svc.parse_decision_cutoff("2026-01-15", "09:00")
    assert iso_str == "2026-01-14T09:00:00Z"
    assert uk_str == "2026-01-14 09:00:00"

    # In summer (e.g. July 15 2026), UK is on BST (UTC+1)
    # 09:00 London time = 08:00 UTC
    utc_dt_summer, iso_summer, uk_summer = svc.parse_decision_cutoff("2026-07-15", "09:00")
    assert iso_summer == "2026-07-14T08:00:00Z"
    assert uk_summer == "2026-07-14 09:00:00"


def test_full_iso_cutoff_parsing():
    """Verify ISO strings with timezone offsets are correctly resolved to UTC."""
    svc = ForecastService()

    utc_dt, iso_str, uk_str = svc.parse_decision_cutoff("2026-01-15", "2026-01-14T10:00:00Z")
    assert iso_str == "2026-01-14T10:00:00Z"
    assert uk_str == "2026-01-14 10:00:00"
