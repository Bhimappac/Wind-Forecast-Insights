from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ["ok", "degraded"]
    assert "version" in data
    assert "actualsLoaded" in data


def test_actuals_endpoint():
    resp = client.get("/api/actuals?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "data" in data
    if data["total"] > 0:
        first = data["data"][0]
        assert "startTime" in first
        assert "startTimeUk" in first
        assert "generation" in first


def test_latest_forecast_endpoint():
    resp = client.get("/api/forecast/latest?delivery_date=2026-01-15")
    assert resp.status_code == 200
    data = resp.json()
    assert data["deliveryDate"] == "2026-01-15"
    assert "kpis" in data
    assert "data" in data
    assert len(data["data"]) == 48


def test_forecast_vintages_endpoint():
    resp = client.get("/api/forecast/vintages?target_time=2026-01-15T12:00:00Z")
    assert resp.status_code == 200
    data = resp.json()
    assert "targetTime" in data
    assert "vintages" in data
    assert isinstance(data["vintages"], list)


def test_accuracy_summary_endpoint():
    resp = client.get("/api/accuracy/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "mae" in data
    assert "rmse" in data
    assert "meanBias" in data
    assert "p90AbsError" in data


def test_accuracy_by_horizon_endpoint():
    resp = client.get("/api/accuracy/by-horizon")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert len(data["data"]) > 0


def test_accuracy_by_hour_endpoint():
    resp = client.get("/api/accuracy/by-hour")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert len(data["data"]) == 24


def test_accuracy_by_day_endpoint():
    resp = client.get("/api/accuracy/by-day")
    assert resp.status_code == 200
    data = resp.json()
    assert "daily" in data
    assert "timeSeries" in data
    assert len(data["daily"]) == 31


def test_export_csv_latest():
    resp = client.get("/api/export.csv?view=latest&delivery_date=2026-01-15")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Settlement Period" in resp.text
    assert "wind_latest_forecast_2026-01-15.csv" in resp.headers["content-disposition"]
