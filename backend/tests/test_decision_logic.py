from backend.app.services.forecast_service import ForecastService


def test_default_decision_time_selection(mock_store):
    """
    Verify that default decision cutoff (09:00 UK on D-1):
    1. Selects the forecast published at 07:30 on D-1.
    2. Does NOT select the forecast published at 11:30 on D-1.
    """
    svc = ForecastService()
    svc.store = mock_store

    res = svc.get_latest_forecast_for_delivery_day("2026-01-15")

    assert res["deliveryDate"] == "2026-01-15"
    assert res["decisionTime"] == "2026-01-14T09:00:00Z"
    assert len(res["data"]) == 48

    # All 48 periods should use the 07:30 publication
    for item in res["data"]:
        assert item["publishTime"] == "2026-01-14T07:30:00Z"
        # Since offset was +500 MW, error (forecast - actual) must be exactly +500
        assert item["error"] == 500.0
        assert item["actualGeneration"] is not None
        assert item["forecastGeneration"] == item["actualGeneration"] + 500.0

    kpis = res["kpis"]
    assert kpis["meanBiasMw"] == 500.0
    assert kpis["maeMw"] == 500.0
    assert kpis["forecastPublishTimeUsed"] == "2026-01-14T07:30:00Z"


def test_custom_decision_time_selection(mock_store):
    """
    If decision time is 12:00 on D-1, it SHOULD select the 11:30 forecast (offset -300).
    If decision time is 06:00 on D-1, it should fall back to D-2 18:00 forecast (offset +1200).
    """
    svc = ForecastService()
    svc.store = mock_store

    # Test 12:00 cutoff -> picks 11:30 forecast
    res_12 = svc.get_latest_forecast_for_delivery_day("2026-01-15", decision_time_param="12:00")
    assert res_12["decisionTime"] == "2026-01-14T12:00:00Z"
    assert res_12["data"][0]["publishTime"] == "2026-01-14T11:30:00Z"
    assert res_12["data"][0]["error"] == -300.0

    # Test 06:00 cutoff -> picks D-2 18:00 forecast
    res_06 = svc.get_latest_forecast_for_delivery_day("2026-01-15", decision_time_param="06:00")
    assert res_06["decisionTime"] == "2026-01-14T06:00:00Z"
    assert res_06["data"][0]["publishTime"] == "2026-01-13T18:00:00Z"
    assert res_06["data"][0]["error"] == 1200.0


def test_horizon_calculation(mock_store):
    """
    Verify horizon is correctly computed as (startTime - publishTime) in hours.
    For interval 2026-01-15T00:00:00Z with publish 2026-01-14T07:30:00Z:
    Horizon = 16.5 hours.
    """
    svc = ForecastService()
    svc.store = mock_store

    res = svc.get_latest_forecast_for_delivery_day("2026-01-15")
    p1 = res["data"][0]  # 00:00 delivery
    assert p1["settlementPeriod"] == 1
    assert p1["horizonHours"] == 16.5

    p48 = res["data"][47]  # 23:30 delivery
    assert p48["settlementPeriod"] == 48
    assert p48["horizonHours"] == 40.0
