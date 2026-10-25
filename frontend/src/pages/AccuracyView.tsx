import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Download, SlidersHorizontal } from 'lucide-react';

import { api } from '../api/client';
import { KPICard } from '../components/KPICard';
import { ErrorAlert } from '../components/ErrorAlert';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const AccuracyView: React.FC = () => {
  const [minHorizon, setMinHorizon] = useState<number | undefined>(undefined);
  const [maxHorizon, setMaxHorizon] = useState<number | undefined>(undefined);

  // Queries
  const summaryQuery = useQuery({
    queryKey: ['accuracySummary', minHorizon, maxHorizon],
    queryFn: () => api.getAccuracySummary(undefined, undefined, minHorizon, maxHorizon),
  });

  const horizonQuery = useQuery({
    queryKey: ['accuracyHorizon'],
    queryFn: () => api.getAccuracyByHorizon(),
  });

  const hourQuery = useQuery({
    queryKey: ['accuracyHour'],
    queryFn: () => api.getAccuracyByHour(),
  });

  const dayQuery = useQuery({
    queryKey: ['accuracyDay'],
    queryFn: () => api.getAccuracyByDay(),
  });

  const isLoading = summaryQuery.isLoading || horizonQuery.isLoading || hourQuery.isLoading || dayQuery.isLoading;
  const isError = summaryQuery.isError || horizonQuery.isError || hourQuery.isError || dayQuery.isError;

  const exportUrl = api.getExportUrl({
    view: 'accuracy',
    min_horizon: minHorizon,
    max_horizon: maxHorizon,
  });

  // Calculate histogram from time series errors
  const timeSeries = dayQuery.data?.timeSeries || [];
  const histogramData = React.useMemo(() => {
    if (!timeSeries.length) return [];
    const binSize = 1000; // 1 GW bins
    const counts: Record<string, number> = {};
    const binMin = -6000;
    const binMax = 6000;

    for (let b = binMin; b < binMax; b += binSize) {
      const label = `${b >= 0 ? '+' : ''}${b / 1000}G`;
      counts[label] = 0;
    }

    timeSeries.forEach(pt => {
      const err = pt.error;
      const bIndex = Math.floor(err / binSize) * binSize;
      const clamped = Math.max(binMin, Math.min(binMax - binSize, bIndex));
      const label = `${clamped >= 0 ? '+' : ''}${clamped / 1000}G`;
      if (counts[label] !== undefined) {
        counts[label]++;
      }
    });

    return Object.entries(counts).map(([bin, count]) => ({ bin, count }));
  }, [timeSeries]);

  // Subsample scatter plot for smooth rendering (up to 400 points)
  const scatterData = React.useMemo(() => {
    if (!timeSeries.length) return [];
    const step = Math.max(1, Math.floor(timeSeries.length / 400));
    return timeSeries
      .filter((_, idx) => idx % step === 0)
      .map(pt => ({
        forecast: pt.forecastGeneration,
        actual: pt.actualGeneration,
        error: pt.error,
        horizon: pt.horizonHours,
      }));
  }, [timeSeries]);

  return (
    <div className="space-y-6">
      {/* Filters & Export Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="h-4 w-4 text-sky-500" />
            <span>Horizon Filter:</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => {
                setMinHorizon(undefined);
                setMaxHorizon(undefined);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                minHorizon === undefined && maxHorizon === undefined
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              All Horizons (0-72h)
            </button>
            <button
              onClick={() => {
                setMinHorizon(12);
                setMaxHorizon(36);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                minHorizon === 12 && maxHorizon === 36
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Day-Ahead Window (12-36h)
            </button>
            <button
              onClick={() => {
                setMinHorizon(0);
                setMaxHorizon(12);
              }}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                minHorizon === 0 && maxHorizon === 12
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Intraday (0-12h)
            </button>
          </div>
        </div>

        <a
          href={exportUrl}
          download
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Metrics CSV</span>
        </a>
      </div>

      {isLoading && <LoadingSkeleton rows={6} />}

      {isError && (
        <ErrorAlert
          message="Failed to load forecast accuracy metrics"
          onRetry={() => {
            summaryQuery.refetch();
            horizonQuery.refetch();
            hourQuery.refetch();
            dayQuery.refetch();
          }}
        />
      )}

      {summaryQuery.data && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KPICard
              title="MAE (Mean Abs Error)"
              value={summaryQuery.data.mae}
              unit="MW"
              subValue="Average magnitude of miss"
              tooltip="Mean Absolute Error across all evaluated periods"
              variant="info"
            />
            <KPICard
              title="RMSE"
              value={summaryQuery.data.rmse}
              unit="MW"
              subValue="Quadratic tail-risk penalty"
              tooltip="Root Mean Squared Error: sensitive to outlier forecast blunders"
            />
            <KPICard
              title="MAPE"
              value={summaryQuery.data.mape}
              unit="%"
              subValue="Percentage error (zero-guarded)"
              tooltip="Mean Absolute Percentage Error guarded against near-zero actuals"
              variant="warning"
            />
            <KPICard
              title="Mean Bias"
              value={
                summaryQuery.data.meanBias !== null
                  ? `${summaryQuery.data.meanBias > 0 ? '+' : ''}${summaryQuery.data.meanBias}`
                  : null
              }
              unit="MW"
              subValue="Forecast - Actual signed bias"
              tooltip="Positive: systematic over-forecasting; Negative: under-forecasting"
              variant={(summaryQuery.data.meanBias || 0) > 0 ? 'warning' : 'success'}
            />
            <KPICard
              title="P90 Error"
              value={summaryQuery.data.p90AbsError}
              unit="MW"
              subValue="90% of misses fall under this"
              tooltip="90th percentile of absolute forecasting errors"
            />
          </div>

          {/* Row 1: Error vs Forecast Horizon & Error by Hour of Day */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Error vs Horizon Chart */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Forecast Error vs Horizon (Lead Time)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  MAE, RMSE, and P90 error degrade as lead time extends from 0h to 48h+
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={horizonQuery.data?.data || []}
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="horizonBin" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={mw => `${(mw / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              Horizon Bin: {d.horizonBin} ({d.sampleCount} samples)
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <div className="flex justify-between gap-4 text-sky-600 dark:text-sky-400">
                                <span>MAE:</span>
                                <strong>{d.mae} MW</strong>
                              </div>
                              <div className="flex justify-between gap-4 text-purple-600 dark:text-purple-400">
                                <span>RMSE:</span>
                                <strong>{d.rmse} MW</strong>
                              </div>
                              <div className="flex justify-between gap-4 text-amber-600 dark:text-amber-400">
                                <span>P90 Error:</span>
                                <strong>{d.p90AbsError} MW</strong>
                              </div>
                              <div className="flex justify-between gap-4 text-slate-500">
                                <span>Mean Bias:</span>
                                <strong>{d.meanBias > 0 ? `+${d.meanBias}` : d.meanBias} MW</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="mae" fill="#0284c7" name="MAE (MW)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rmse" fill="#8b5cf6" name="RMSE (MW)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="p90AbsError" fill="#f59e0b" name="P90 (MW)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Error by Hour of Day Chart */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Forecast Accuracy by Hour of Day (UK Time)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identifies diurnal error patterns across morning and evening ramp periods
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={hourQuery.data?.data || []}
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="hourLabel" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={mw => `${(mw / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 font-sans">
                              Hour {d.hourLabel} UK ({d.sampleCount} periods)
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <div className="text-sky-600">MAE: {d.mae} MW</div>
                              <div className="text-emerald-600">Avg Actual: {d.avgActualMw} MW</div>
                              <div className="text-amber-600">
                                Bias: {d.meanBias > 0 ? `+${d.meanBias}` : d.meanBias} MW
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="mae" fill="#0284c7" name="MAE (MW)" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="meanBias"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      name="Mean Bias (MW)"
                    />
                    <ReferenceLine y={0} stroke="#888888" strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Daily Error Trend & Error Distribution Histogram */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Error Trend across January 2026 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daily MAE and Bias Trend (Jan 1-31, 2026)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tracks day-to-day volatility and storm front forecasting performance
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={dayQuery.data?.daily || []}
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="deliveryDate"
                      tickFormatter={d => d.slice(8, 10)}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={mw => `${(mw / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 font-sans">
                              {d.deliveryDate}
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <div className="text-sky-600">MAE: {d.mae} MW</div>
                              <div className="text-purple-600">RMSE: {d.rmse} MW</div>
                              <div className="text-amber-600">Bias: {d.meanBias} MW</div>
                              <div className="text-emerald-600">Avg Actual: {d.avgActualMw} MW</div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="mae" fill="#38bdf8" name="Daily MAE (MW)" radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="meanBias"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Daily Bias (MW)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Error Distribution Histogram */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Forecast Error Distribution (MW Bins)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shows error skewness (positive bias shifted right of 0 GW center)
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="bin" stroke="#888888" fontSize={11} tickLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-2.5 shadow-xl backdrop-blur-md text-xs font-mono">
                            <div>Bin: {d.bin}</div>
                            <div className="font-semibold text-sky-600">Count: {d.count} periods</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="count" fill="#6366f1" name="Period Count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: Scatter Plot of Forecast vs Actual */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Forecast vs Actual Generation Correlation (Scatter)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Points above the diagonal reference line indicate over-forecasting (Forecast &gt; Actual)
              </p>
            </div>

            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    type="number"
                    dataKey="actual"
                    name="Actual Generation"
                    unit=" MW"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="number"
                    dataKey="forecast"
                    name="Forecast Generation"
                    unit=" MW"
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono">
                          <div className="text-emerald-600">Actual: {d.actual?.toLocaleString()} MW</div>
                          <div className="text-sky-600">Forecast: {d.forecast?.toLocaleString()} MW</div>
                          <div className="text-amber-600">
                            Error: {d.error > 0 ? `+${d.error}` : d.error} MW
                          </div>
                          <div className="text-slate-400">Horizon: {d.horizon}h</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    name="Forecast vs Outturn Pairs"
                    data={scatterData}
                    fill="#0284c7"
                    fillOpacity={0.6}
                  />
                  {/* 1:1 Parity reference line */}
                  <ReferenceLine
                    segment={[
                      { x: 0, y: 0 },
                      { x: 20000, y: 20000 },
                    ]}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: '1:1 Parity', fill: '#ef4444', fontSize: 10, position: 'top' }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
