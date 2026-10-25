import csv
import io
from datetime import UTC, datetime

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from backend.app.models.schemas import (
    AccuracySummaryResponse,
    ActualItem,
    ActualsResponse,
    DailyAccuracyResponse,
    HealthResponse,
    HorizonAccuracyResponse,
    HourOfDayAccuracyResponse,
    LatestForecastResponse,
    VintagesResponse,
)
from backend.app.services.data_store import data_store
from backend.app.services.forecast_service import forecast_service
from backend.app.services.metrics_service import MetricsService

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def get_health():
    """Health check endpoint exposing snapshot status and record counts."""
    act_len, fc_len = (
        data_store.load_snapshots()
        if not data_store._is_loaded
        else (len(data_store.df_actuals), len(data_store.df_forecasts))
    )
    status_str = "ok" if (act_len > 0 and fc_len > 0) else "degraded"

    act_range = None
    if not data_store.df_actuals.empty:
        act_range = f"{data_store.df_actuals['startTime'].min()} to {data_store.df_actuals['startTime'].max()}"

    fc_range = None
    if not data_store.df_forecasts.empty:
        fc_range = f"{data_store.df_forecasts['startTime'].min()} to {data_store.df_forecasts['startTime'].max()}"

    return HealthResponse(
        status=status_str,
        timestamp=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        actualsLoaded=act_len,
        forecastsLoaded=fc_len,
        dateRangeActuals=act_range,
        dateRangeForecasts=fc_range,
        version="1.0.0",
    )


@router.get("/actuals", response_model=ActualsResponse, tags=["Actuals"])
async def get_actuals(
    from_time: str | None = Query(None, alias="from", description="From interval UTC ISO"),
    to_time: str | None = Query(None, alias="to", description="To interval UTC ISO"),
):
    """Retrieve actual wind generation in half-hourly settlement periods (MW)."""
    from_ts = pd.to_datetime(from_time, utc=True) if from_time else None
    to_ts = pd.to_datetime(to_time, utc=True) if to_time else None

    df = data_store.get_actuals(from_dt=from_ts, to_dt=to_ts)
    items = []
    for _, row in df.iterrows():
        items.append(
            ActualItem(
                startTime=row["startTime"],
                publishTime=row.get("publishTime"),
                startTimeUk=row["startTime_uk"],
                settlementDate=str(row["settlementDate"]),
                settlementPeriod=int(row["settlementPeriod"]),
                generation=float(row["generation"]),
            )
        )
    return ActualsResponse(
        total=len(items),
        fromTime=from_time,
        toTime=to_time,
        data=items,
    )


@router.get("/forecast/latest", response_model=LatestForecastResponse, tags=["Forecasts"])
async def get_latest_forecast(
    delivery_date: str = Query(..., description="Delivery date YYYY-MM-DD e.g. 2026-01-15"),
    decision_time: str | None = Query(
        None,
        description="Decision cutoff (e.g. '09:00' UK time on D-1, or full ISO timestamp '2026-01-14T09:00:00Z')",
    ),
):
    """
    For each half-hour of the delivery day, return the most recent forecast
    with publishTime <= decision_time, plus actuals if available.
    """
    try:
        result = forecast_service.get_latest_forecast_for_delivery_day(delivery_date, decision_time)
        return LatestForecastResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to compute latest forecast: {e!s}")


@router.get("/forecast/vintages", response_model=VintagesResponse, tags=["Forecasts"])
async def get_forecast_vintages(
    target_time: str = Query(..., description="Target delivery half-hour interval e.g. '2026-01-15T12:00:00Z'"),
):
    """All forecasts published for one target time, showing how the forecast evolved."""
    try:
        result = forecast_service.get_forecast_vintages(target_time)
        return VintagesResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get vintages: {e!s}")


@router.get("/accuracy/summary", response_model=AccuracySummaryResponse, tags=["Accuracy"])
async def get_accuracy_summary(
    from_time: str | None = Query(None, alias="from", description="Target start UTC ISO"),
    to_time: str | None = Query(None, alias="to", description="Target end UTC ISO"),
    min_horizon: float | None = Query(None, description="Minimum forecast horizon in hours"),
    max_horizon: float | None = Query(None, description="Maximum forecast horizon in hours"),
):
    """Key accuracy KPIs: MAE, RMSE, MAPE (zero-guarded), mean bias, and absolute error percentiles (P50/P90/P95/P99)."""
    matched = forecast_service.get_matched_forecasts_and_actuals(
        from_time=from_time,
        to_time=to_time,
        min_horizon=min_horizon,
        max_horizon=max_horizon,
    )
    summary = MetricsService.calculate_summary_metrics(
        matched,
        from_time=from_time,
        to_time=to_time,
        min_horizon=min_horizon,
        max_horizon=max_horizon,
    )
    return AccuracySummaryResponse(**summary)


@router.get("/accuracy/by-horizon", response_model=HorizonAccuracyResponse, tags=["Accuracy"])
async def get_accuracy_by_horizon(
    from_time: str | None = Query(None, alias="from"),
    to_time: str | None = Query(None, alias="to"),
):
    """Error metrics grouped by forecast horizon bins (hours between publishTime and startTime)."""
    matched = forecast_service.get_matched_forecasts_and_actuals(from_time=from_time, to_time=to_time)
    bins_data = MetricsService.calculate_by_horizon(matched)
    return HorizonAccuracyResponse(totalSamples=len(matched), data=bins_data)


@router.get("/accuracy/by-hour", response_model=HourOfDayAccuracyResponse, tags=["Accuracy"])
async def get_accuracy_by_hour(
    from_time: str | None = Query(None, alias="from"),
    to_time: str | None = Query(None, alias="to"),
):
    """Error metrics grouped by UK local hour of day (0 to 23)."""
    matched = forecast_service.get_matched_forecasts_and_actuals(from_time=from_time, to_time=to_time)
    hours_data = MetricsService.calculate_by_hour(matched)
    return HourOfDayAccuracyResponse(data=hours_data)


@router.get("/accuracy/by-day", response_model=DailyAccuracyResponse, tags=["Accuracy"])
async def get_accuracy_by_day(
    from_time: str | None = Query(None, alias="from"),
    to_time: str | None = Query(None, alias="to"),
):
    """Grouped metrics by delivery day, plus continuous error time series."""
    matched = forecast_service.get_matched_forecasts_and_actuals(from_time=from_time, to_time=to_time)
    daily, time_series = MetricsService.calculate_by_day(matched)
    return DailyAccuracyResponse(daily=daily, timeSeries=time_series)


@router.get("/export.csv", tags=["Export"])
async def export_csv(
    view: str = Query("latest", description="View type: 'latest', 'accuracy', 'vintages', 'actuals'"),
    delivery_date: str | None = Query("2026-01-15"),
    decision_time: str | None = Query(None),
    target_time: str | None = Query(None),
    from_time: str | None = Query(None, alias="from"),
    to_time: str | None = Query(None, alias="to"),
    min_horizon: float | None = Query(None),
    max_horizon: float | None = Query(None),
):
    """Export the dataset behind any view as a formatted CSV file."""
    output = io.StringIO()
    writer = csv.writer(output)

    if view == "latest":
        date_str = delivery_date or "2026-01-15"
        res = forecast_service.get_latest_forecast_for_delivery_day(date_str, decision_time)
        filename = f"wind_latest_forecast_{date_str}.csv"
        writer.writerow(
            [
                "Settlement Period",
                "Start Time (UTC)",
                "Start Time (UK)",
                "Forecast Generation (MW)",
                "Publish Time (UTC)",
                "Publish Time (UK)",
                "Actual Generation (MW)",
                "Forecast Error (MW)",
                "Abs Error (MW)",
                "Horizon (Hours)",
                "Expected Lower P90 (MW)",
                "Expected Upper P90 (MW)",
            ]
        )
        for row in res["data"]:
            writer.writerow(
                [
                    row["settlementPeriod"],
                    row["startTime"],
                    row["startTimeUk"],
                    row["forecastGeneration"],
                    row["publishTime"],
                    row["publishTimeUk"],
                    row["actualGeneration"],
                    row["error"],
                    row["absError"],
                    row["horizonHours"],
                    row["expectedLowerP90"],
                    row["expectedUpperP90"],
                ]
            )

    elif view == "vintages":
        tgt = target_time or "2026-01-15T12:00:00Z"
        res = forecast_service.get_forecast_vintages(tgt)
        safe_tgt = tgt.replace(":", "-")
        filename = f"wind_vintages_{safe_tgt}.csv"
        writer.writerow(
            [
                "Target Time (UTC)",
                "Publish Time (UTC)",
                "Publish Time (UK)",
                "Horizon (Hours)",
                "Forecast (MW)",
                "Actual (MW)",
                "Error (MW)",
            ]
        )
        for v in res["vintages"]:
            writer.writerow(
                [
                    res["targetTime"],
                    v["publishTime"],
                    v["publishTimeUk"],
                    v["horizonHours"],
                    v["forecastGeneration"],
                    v["actualGeneration"],
                    v["error"],
                ]
            )

    elif view == "accuracy":
        filename = "wind_accuracy_jan2026.csv"
        matched = forecast_service.get_matched_forecasts_and_actuals(
            from_time=from_time,
            to_time=to_time,
            min_horizon=min_horizon,
            max_horizon=max_horizon,
        )
        writer.writerow(
            [
                "Start Time (UTC)",
                "Start Time (UK)",
                "Publish Time (UTC)",
                "Horizon (Hours)",
                "Forecast (MW)",
                "Actual (MW)",
                "Error (MW)",
                "Abs Error (MW)",
            ]
        )
        for _, row in matched.iterrows():
            writer.writerow(
                [
                    row["startTime"],
                    row["startTimeUk"],
                    row["publishTime"],
                    row["horizonHours"],
                    row["forecastGeneration"],
                    row["actualGeneration"],
                    row["error"],
                    row["abs_error"],
                ]
            )

    else:  # actuals
        filename = "wind_actuals_jan2026.csv"
        from_ts = pd.to_datetime(from_time, utc=True) if from_time else None
        to_ts = pd.to_datetime(to_time, utc=True) if to_time else None
        df = data_store.get_actuals(from_dt=from_ts, to_dt=to_ts)
        writer.writerow(
            ["Start Time (UTC)", "Start Time (UK)", "Settlement Date", "Settlement Period", "Generation (MW)"]
        )
        for _, row in df.iterrows():
            writer.writerow(
                [
                    row["startTime"],
                    row["startTime_uk"],
                    row["settlementDate"],
                    row["settlementPeriod"],
                    row["generation"],
                ]
            )

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
