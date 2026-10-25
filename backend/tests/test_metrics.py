import numpy as np
import pandas as pd

from backend.app.services.metrics_service import MetricsService


def test_metric_formulas():
    """Verify MAE, RMSE, MAPE, Mean Bias, and percentiles."""
    # Construct synthetic dataset
    # actuals = [1000, 2000, 3000, 4000]
    # forecasts = [1200, 1900, 3300, 3800]
    # error = forecast - actual = [+200, -100, +300, -200]
    # abs_error = [200, 100, 300, 200]
    # MAE = (200 + 100 + 300 + 200)/4 = 200
    # RMSE = sqrt((40000 + 10000 + 90000 + 40000)/4) = sqrt(45000) = 212.13
    # Mean Bias = (200 - 100 + 300 - 200)/4 = 50.0
    # MAPE = (200/1000 + 100/2000 + 300/3000 + 200/4000)/4 * 100 = (0.2 + 0.05 + 0.1 + 0.05)/4 * 100 = 10.0%
    data = {
        "actualGeneration": [1000.0, 2000.0, 3000.0, 4000.0],
        "forecastGeneration": [1200.0, 1900.0, 3300.0, 3800.0],
        "error": [200.0, -100.0, 300.0, -200.0],
        "abs_error": [200.0, 100.0, 300.0, 200.0],
    }
    df = pd.DataFrame(data)

    metrics = MetricsService.calculate_summary_metrics(df)

    assert metrics["sampleCount"] == 4
    assert metrics["mae"] == 200.0
    assert metrics["rmse"] == round(np.sqrt(45000), 2)
    assert metrics["meanBias"] == 50.0
    assert metrics["mape"] == 10.0
    assert metrics["p50AbsError"] == 200.0
    assert metrics["maxOverForecast"] == 300.0
    assert metrics["maxUnderForecast"] == -200.0


def test_mape_zero_division_guard():
    """Verify MAPE guards against actualGeneration == 0 without producing NaN or inf."""
    data = {
        "actualGeneration": [0.0, 0.0],
        "forecastGeneration": [100.0, 50.0],
        "error": [100.0, 50.0],
        "abs_error": [100.0, 50.0],
    }
    df = pd.DataFrame(data)

    metrics = MetricsService.calculate_summary_metrics(df)

    assert metrics["mape"] is not None
    assert not np.isnan(metrics["mape"])
    assert not np.isinf(metrics["mape"])
    # 100/1.0 = 100, 50/1.0 = 50 -> avg = 75 * 100 = 7500.0%
    assert metrics["mape"] == 7500.0


def test_by_horizon_binning():
    """Verify horizon binning properly groups forecasts."""
    data = {
        "actualGeneration": [1000.0, 1000.0, 1000.0],
        "forecastGeneration": [1100.0, 1200.0, 1300.0],
        "error": [100.0, 200.0, 300.0],
        "abs_error": [100.0, 200.0, 300.0],
        "horizonHours": [2.0, 5.0, 15.0],
    }
    df = pd.DataFrame(data)

    bins = MetricsService.calculate_by_horizon(df)
    bin_labels = [b["horizonBin"] for b in bins]

    assert "0-3h" in bin_labels
    assert "3-6h" in bin_labels
    assert "12-18h" in bin_labels

    bin_0_3 = next(b for b in bins if b["horizonBin"] == "0-3h")
    assert bin_0_3["sampleCount"] == 1
    assert bin_0_3["mae"] == 100.0
