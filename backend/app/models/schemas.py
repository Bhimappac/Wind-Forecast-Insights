from pydantic import BaseModel, Field


class ActualItem(BaseModel):
    startTime: str = Field(..., description="UTC ISO 8601 interval start time")
    publishTime: str | None = Field(None, description="UTC ISO 8601 publish time")
    startTimeUk: str = Field(..., description="Europe/London local time")
    settlementDate: str = Field(..., description="Settlement date YYYY-MM-DD")
    settlementPeriod: int = Field(..., description="Half-hour settlement period 1-48")
    generation: float = Field(..., description="Actual wind generation in MW")


class ActualsResponse(BaseModel):
    total: int
    fromTime: str | None = None
    toTime: str | None = None
    data: list[ActualItem]


class LatestForecastItem(BaseModel):
    startTime: str = Field(..., description="Target delivery interval UTC ISO")
    startTimeUk: str = Field(..., description="Target delivery interval London local time")
    settlementPeriod: int = Field(..., description="Settlement period 1-48")
    forecastGeneration: float | None = Field(None, description="Latest forecast wind generation in MW")
    publishTime: str | None = Field(None, description="Publish time of forecast used (UTC ISO)")
    publishTimeUk: str | None = Field(None, description="Publish time in London local time")
    actualGeneration: float | None = Field(None, description="Outturn actual wind generation in MW")
    error: float | None = Field(None, description="Forecast Error = Forecast - Actual (MW)")
    absError: float | None = Field(None, description="Absolute error in MW")
    horizonHours: float | None = Field(None, description="Forecast horizon in hours (startTime - publishTime)")
    expectedLowerP90: float | None = Field(None, description="Expected 90% confidence lower bound (MW)")
    expectedUpperP90: float | None = Field(None, description="Expected 90% confidence upper bound (MW)")


class LatestForecastKPICards(BaseModel):
    deliveryDate: str
    decisionTimeUsed: str
    decisionTimeUk: str
    forecastPublishTimeUsed: str | None = None
    peakForecastMw: float | None = None
    peakForecastTimeUk: str | None = None
    avgForecastMw: float | None = None
    minForecastMw: float | None = None
    minForecastTimeUk: str | None = None
    totalForecastMwh: float | None = None
    avgActualMw: float | None = None
    totalActualMwh: float | None = None
    maeMw: float | None = None
    meanBiasMw: float | None = None
    expectedP90BandMw: float | None = None


class LatestForecastResponse(BaseModel):
    deliveryDate: str
    decisionTime: str
    decisionTimeUk: str
    kpis: LatestForecastKPICards
    data: list[LatestForecastItem]


class VintageItem(BaseModel):
    publishTime: str
    publishTimeUk: str
    horizonHours: float
    forecastGeneration: float
    actualGeneration: float | None = None
    error: float | None = None


class VintagesResponse(BaseModel):
    targetTime: str
    targetTimeUk: str
    actualGeneration: float | None = None
    totalVintages: int
    vintages: list[VintageItem]


class AccuracySummaryResponse(BaseModel):
    sampleCount: int
    mae: float | None = Field(None, description="Mean Absolute Error (MW)")
    rmse: float | None = Field(None, description="Root Mean Squared Error (MW)")
    mape: float | None = Field(None, description="Mean Absolute Percentage Error (%) guarded against 0")
    meanBias: float | None = Field(None, description="Mean Bias = Mean(Forecast - Actual) (MW)")
    medianBias: float | None = Field(None, description="Median Bias (MW)")
    p50AbsError: float | None = Field(None, description="50th percentile of |Error| (MW)")
    p90AbsError: float | None = Field(None, description="90th percentile of |Error| (MW)")
    p95AbsError: float | None = Field(None, description="95th percentile of |Error| (MW)")
    p99AbsError: float | None = Field(None, description="99th percentile of |Error| (MW)")
    maxOverForecast: float | None = Field(None, description="Maximum positive error (MW)")
    maxUnderForecast: float | None = Field(None, description="Maximum negative error (MW)")
    fromTime: str | None = None
    toTime: str | None = None
    minHorizonHours: float | None = None
    maxHorizonHours: float | None = None


class HorizonAccuracyItem(BaseModel):
    horizonBin: str = Field(..., description="Horizon bin e.g. '0-3h', '3-6h'")
    minHorizon: float
    maxHorizon: float
    sampleCount: int
    avgForecastMw: float
    avgActualMw: float
    mae: float
    rmse: float
    mape: float | None = None
    meanBias: float
    p50AbsError: float
    p90AbsError: float
    p95AbsError: float


class HorizonAccuracyResponse(BaseModel):
    totalSamples: int
    data: list[HorizonAccuracyItem]


class HourOfDayAccuracyItem(BaseModel):
    hourUk: int = Field(..., description="Hour of day in London local time (0-23)")
    hourLabel: str = Field(..., description="Display label e.g. 00:00")
    sampleCount: int
    avgForecastMw: float
    avgActualMw: float
    mae: float
    rmse: float
    meanBias: float
    p90AbsError: float


class HourOfDayAccuracyResponse(BaseModel):
    data: list[HourOfDayAccuracyItem]


class DailyAccuracyItem(BaseModel):
    deliveryDate: str
    sampleCount: int
    avgForecastMw: float
    avgActualMw: float
    mae: float
    rmse: float
    meanBias: float
    mape: float | None = None
    p90AbsError: float


class ErrorTimeSeriesItem(BaseModel):
    startTime: str
    startTimeUk: str
    forecastGeneration: float
    actualGeneration: float
    error: float
    absError: float
    horizonHours: float


class DailyAccuracyResponse(BaseModel):
    daily: list[DailyAccuracyItem]
    timeSeries: list[ErrorTimeSeriesItem]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    actualsLoaded: int
    forecastsLoaded: int
    dateRangeActuals: str | None = None
    dateRangeForecasts: str | None = None
    version: str
