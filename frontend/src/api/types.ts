export interface ActualItem {
  startTime: string;
  publishTime?: string;
  startTimeUk: string;
  settlementDate: string;
  settlementPeriod: number;
  generation: number;
}

export interface ActualsResponse {
  total: number;
  fromTime?: string;
  toTime?: string;
  data: ActualItem[];
}

export interface LatestForecastItem {
  startTime: string;
  startTimeUk: string;
  settlementPeriod: number;
  forecastGeneration: number | null;
  publishTime: string | null;
  publishTimeUk: string | null;
  actualGeneration: number | null;
  error: number | null;
  absError: number | null;
  horizonHours: number | null;
  expectedLowerP90: number | null;
  expectedUpperP90: number | null;
}

export interface LatestForecastKPICards {
  deliveryDate: string;
  decisionTimeUsed: string;
  decisionTimeUk: string;
  forecastPublishTimeUsed: string | null;
  peakForecastMw: number | null;
  peakForecastTimeUk: string | null;
  avgForecastMw: number | null;
  minForecastMw: number | null;
  minForecastTimeUk: string | null;
  totalForecastMwh: number | null;
  avgActualMw: number | null;
  totalActualMwh: number | null;
  maeMw: number | null;
  meanBiasMw: number | null;
  expectedP90BandMw: number | null;
}

export interface LatestForecastResponse {
  deliveryDate: string;
  decisionTime: string;
  decisionTimeUk: string;
  kpis: LatestForecastKPICards;
  data: LatestForecastItem[];
}

export interface VintageItem {
  publishTime: string;
  publishTimeUk: string;
  horizonHours: number;
  forecastGeneration: number;
  actualGeneration: number | null;
  error: number | null;
}

export interface VintagesResponse {
  targetTime: string;
  targetTimeUk: string;
  actualGeneration: number | null;
  totalVintages: number;
  vintages: VintageItem[];
}

export interface AccuracySummaryResponse {
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  meanBias: number | null;
  medianBias: number | null;
  p50AbsError: number | null;
  p90AbsError: number | null;
  p95AbsError: number | null;
  p99AbsError: number | null;
  maxOverForecast: number | null;
  maxUnderForecast: number | null;
  fromTime?: string;
  toTime?: string;
  minHorizonHours?: number;
  maxHorizonHours?: number;
}

export interface HorizonAccuracyItem {
  horizonBin: string;
  minHorizon: number;
  maxHorizon: number;
  sampleCount: number;
  avgForecastMw: number;
  avgActualMw: number;
  mae: number;
  rmse: number;
  mape?: number;
  meanBias: number;
  p50AbsError: number;
  p90AbsError: number;
  p95AbsError: number;
}

export interface HorizonAccuracyResponse {
  totalSamples: number;
  data: HorizonAccuracyItem[];
}

export interface HourOfDayAccuracyItem {
  hourUk: number;
  hourLabel: string;
  sampleCount: number;
  avgForecastMw: number;
  avgActualMw: number;
  mae: number;
  rmse: number;
  meanBias: number;
  p90AbsError: number;
}

export interface HourOfDayAccuracyResponse {
  data: HourOfDayAccuracyItem[];
}

export interface DailyAccuracyItem {
  deliveryDate: string;
  sampleCount: number;
  avgForecastMw: number;
  avgActualMw: number;
  mae: number;
  rmse: number;
  meanBias: number;
  mape?: number;
  p90AbsError: number;
}

export interface ErrorTimeSeriesItem {
  startTime: string;
  startTimeUk: string;
  forecastGeneration: number;
  actualGeneration: number;
  error: number;
  absError: number;
  horizonHours: number;
}

export interface DailyAccuracyResponse {
  daily: DailyAccuracyItem[];
  timeSeries: ErrorTimeSeriesItem[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  actualsLoaded: number;
  forecastsLoaded: number;
  dateRangeActuals?: string;
  dateRangeForecasts?: string;
  version: string;
}
