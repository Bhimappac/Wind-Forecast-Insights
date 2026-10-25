import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Download,
  Clock,
  TrendingUp,
  TrendingDown,
  Wind,
  CheckCircle,
} from 'lucide-react';

import { api } from '../api/client';
import { KPICard } from '../components/KPICard';
import { ErrorAlert } from '../components/ErrorAlert';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface DecisionViewProps {
  deliveryDate: string;
  setDeliveryDate: (d: string) => void;
  decisionTime: string;
  setDecisionTime: (t: string) => void;
}

export const DecisionView: React.FC<DecisionViewProps> = ({
  deliveryDate,
  setDeliveryDate,
  decisionTime,
  setDecisionTime,
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'chart' | 'table'>('both');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['latestForecast', deliveryDate, decisionTime],
    queryFn: () => api.getLatestForecast(deliveryDate, decisionTime),
    staleTime: 60_000,
  });

  const exportUrl = api.getExportUrl({
    view: 'latest',
    delivery_date: deliveryDate,
    decision_time: decisionTime,
  });

  // Decision time presets
  const presets = [
    { label: '09:00 UK (Standard D-1)', value: '09:00' },
    { label: '07:30 UK (Early run)', value: '07:30' },
    { label: '11:00 UK (Pre-gate)', value: '11:00' },
    { label: '06:00 UK (Morning shift)', value: '06:00' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Delivery Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Delivery Day (Jan 2026)
            </label>
            <div className="relative mt-1">
              <input
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Decision Time Cutoff */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Decision Cutoff (UK Time on D-1)
            </label>
            <div className="flex items-center gap-2 mt-1">
              <select
                value={presets.some(p => p.value === decisionTime) ? decisionTime : 'custom'}
                onChange={e => {
                  if (e.target.value !== 'custom') {
                    setDecisionTime(e.target.value);
                  }
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {presets.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom Time...</option>
              </select>

              <input
                type="time"
                value={decisionTime.length === 5 ? decisionTime : '09:00'}
                onChange={e => setDecisionTime(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* View toggle & CSV Export */}
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setViewMode('both')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'both'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Both
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'chart'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Table
            </button>
          </div>

          <a
            href={exportUrl}
            download
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {isLoading && <LoadingSkeleton rows={8} />}

      {error && (
        <ErrorAlert
          message={(error as Error).message || 'Failed to fetch latest forecast'}
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Peak Forecast"
              value={data.kpis.peakForecastMw}
              unit="MW"
              subValue={`At ${data.kpis.peakForecastTimeUk ? data.kpis.peakForecastTimeUk.slice(11, 16) : '—'} UK`}
              tooltip="Maximum expected half-hour generation during delivery day"
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              variant="success"
            />
            <KPICard
              title="Average Forecast"
              value={data.kpis.avgForecastMw}
              unit="MW"
              subValue={`Total: ${data.kpis.totalForecastMwh ? data.kpis.totalForecastMwh.toLocaleString() : '—'} MWh`}
              tooltip="Mean expected wind output across the 48 settlement periods"
              icon={<Wind className="h-4 w-4 text-sky-500" />}
              variant="info"
            />
            <KPICard
              title="Min Forecast"
              value={data.kpis.minForecastMw}
              unit="MW"
              subValue={`At ${data.kpis.minForecastTimeUk ? data.kpis.minForecastTimeUk.slice(11, 16) : '—'} UK`}
              tooltip="Minimum expected generation (thermal/hydro procurement peak)"
              icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
            />
            <KPICard
              title="Expected P90 Band"
              value={`±${data.kpis.expectedP90BandMw}`}
              unit="MW"
              subValue={`Historical error at ~${data.data[0]?.horizonHours?.toFixed(0) || 24}h horizon`}
              tooltip="Historical 90% confidence uncertainty buffer based on Jan 2026 data"
              icon={<CheckCircle className="h-4 w-4 text-purple-500" />}
              variant="warning"
            />
          </div>

          {/* Secondary KPI Bar: Decision Context & Outturn MAE */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-500" />
              <span>
                Decision Cutoff Applied: <strong className="font-mono text-slate-900 dark:text-slate-200">{data.kpis.decisionTimeUk} UK</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span>
                Forecast Run Used: <strong className="font-mono text-slate-900 dark:text-slate-200">{data.kpis.forecastPublishTimeUsed || 'None'}</strong>
              </span>
            </div>

            {data.kpis.avgActualMw !== null && (
              <div className="flex items-center gap-3">
                <span>
                  Actual Average: <strong className="font-mono text-slate-900 dark:text-slate-200">{data.kpis.avgActualMw} MW</strong>
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  Day MAE: <strong className="font-mono text-slate-900 dark:text-slate-200">{data.kpis.maeMw} MW</strong>
                </span>
                <span className="text-slate-400">•</span>
                <span>
                  Bias: <strong className={`font-mono ${(data.kpis.meanBiasMw || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {(data.kpis.meanBiasMw || 0) > 0 ? `+${data.kpis.meanBiasMw}` : data.kpis.meanBiasMw} MW
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Chart View */}
          {(viewMode === 'both' || viewMode === 'chart') && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Day-Ahead Wind Forecast vs Actual Generation (Half-Hourly)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Includes historical P90 uncertainty envelope (shaded) available at decision time
                  </p>
                </div>
              </div>

              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.data}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="settlementPeriod"
                      tickFormatter={sp => `SP ${sp}`}
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={mw => `${(mw / 1000).toFixed(0)} GW`}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-3 shadow-xl backdrop-blur-md text-xs font-sans">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              Settlement Period {d.settlementPeriod} • {d.startTimeUk.slice(11, 16)} UK
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              UTC: {d.startTime}
                            </div>
                            <div className="mt-2 space-y-1 font-mono">
                              <div className="flex justify-between gap-4 text-sky-600 dark:text-sky-400">
                                <span>Forecast:</span>
                                <strong>{d.forecastGeneration?.toLocaleString()} MW</strong>
                              </div>
                              <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                                <span>Actual:</span>
                                <strong>{d.actualGeneration !== null ? `${d.actualGeneration?.toLocaleString()} MW` : 'Pending'}</strong>
                              </div>
                              {d.error !== null && (
                                <div className="flex justify-between gap-4 text-amber-600 dark:text-amber-400 border-t border-slate-100 dark:border-slate-800 pt-1">
                                  <span>Error (FC - Act):</span>
                                  <strong>{d.error > 0 ? `+${d.error}` : d.error} MW</strong>
                                </div>
                              )}
                              <div className="flex justify-between gap-4 text-purple-600 dark:text-purple-400 text-[11px]">
                                <span>P90 Range:</span>
                                <span>
                                  {d.expectedLowerP90?.toLocaleString()} - {d.expectedUpperP90?.toLocaleString()} MW
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 pt-1">
                                Horizon: {d.horizonHours}h • Published: {d.publishTimeUk?.slice(11, 16) || '—'}
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend verticalAlign="top" height={36} />

                    {/* Shaded P90 Confidence Area */}
                    <Area
                      type="monotone"
                      dataKey="expectedUpperP90"
                      stroke="none"
                      fill="#8b5cf6"
                      fillOpacity={0.12}
                      name="P90 Confidence Upper"
                    />
                    <Area
                      type="monotone"
                      dataKey="expectedLowerP90"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={0.0}
                      name="P90 Confidence Lower"
                    />

                    {/* Forecast Line */}
                    <Line
                      type="monotone"
                      dataKey="forecastGeneration"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="Day-Ahead Forecast (MW)"
                    />

                    {/* Actual Generation Line */}
                    <Line
                      type="monotone"
                      dataKey="actualGeneration"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="Actual Generation (MW)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Table View */}
          {(viewMode === 'both' || viewMode === 'table') && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Half-Hourly Settlement Schedule
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    All 48 half-hour trading blocks with outturns and errors
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[440px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                    <tr>
                      <th className="p-3">SP</th>
                      <th className="p-3">Time (UK)</th>
                      <th className="p-3">Time (UTC)</th>
                      <th className="p-3 text-right">Forecast (MW)</th>
                      <th className="p-3 text-right">Actual (MW)</th>
                      <th className="p-3 text-right">Error (MW)</th>
                      <th className="p-3 text-right">Horizon</th>
                      <th className="p-3 text-right">P90 Band</th>
                      <th className="p-3">Publish Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {data.data.map(row => {
                      const isOver = (row.error || 0) > 0;
                      return (
                        <tr
                          key={row.settlementPeriod}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">
                            {row.settlementPeriod}
                          </td>
                          <td className="p-3 font-sans text-slate-700 dark:text-slate-300">
                            {row.startTimeUk.slice(11, 16)}
                          </td>
                          <td className="p-3 text-slate-400 font-sans">
                            {row.startTime.slice(11, 16)}Z
                          </td>
                          <td className="p-3 text-right font-semibold text-sky-600 dark:text-sky-400">
                            {row.forecastGeneration?.toLocaleString() ?? '—'}
                          </td>
                          <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {row.actualGeneration?.toLocaleString() ?? '—'}
                          </td>
                          <td className="p-3 text-right">
                            {row.error !== null ? (
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                  isOver
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {isOver ? `+${row.error}` : row.error}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 text-right text-slate-500">
                            {row.horizonHours ? `${row.horizonHours}h` : '—'}
                          </td>
                          <td className="p-3 text-right text-purple-600 dark:text-purple-400 text-[11px]">
                            {row.expectedLowerP90} - {row.expectedUpperP90}
                          </td>
                          <td className="p-3 font-sans text-slate-500 text-[11px]">
                            {row.publishTimeUk?.slice(11, 16) || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
