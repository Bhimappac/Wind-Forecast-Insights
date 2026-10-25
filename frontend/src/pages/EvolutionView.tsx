import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Download, History } from 'lucide-react';

import { api } from '../api/client';
import { KPICard } from '../components/KPICard';
import { ErrorAlert } from '../components/ErrorAlert';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

interface EvolutionViewProps {
  targetTime: string;
  setTargetTime: (t: string) => void;
}

export const EvolutionView: React.FC<EvolutionViewProps> = ({
  targetTime,
  setTargetTime,
}) => {
  // Preset target times
  const presets = [
    { label: 'Jan 15 12:00 (Mid-month peak)', value: '2026-01-15T12:00:00Z' },
    { label: 'Jan 15 18:00 (Evening demand peak)', value: '2026-01-15T18:00:00Z' },
    { label: 'Jan 08 14:00 (Winter storm front)', value: '2026-01-08T14:00:00Z' },
    { label: 'Jan 22 03:00 (High overnight wind)', value: '2026-01-22T03:00:00Z' },
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['forecastVintages', targetTime],
    queryFn: () => api.getForecastVintages(targetTime),
  });

  const exportUrl = api.getExportUrl({
    view: 'vintages',
    target_time: targetTime,
  });

  // Calculate revisions between successive vintages
  const vintagesWithDelta = React.useMemo(() => {
    if (!data?.vintages) return [];
    return data.vintages.map((v, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : null;
      const revision = prev ? v.forecastGeneration - prev.forecastGeneration : 0;
      return {
        ...v,
        revision,
      };
    });
  }, [data]);

  const firstVintage = vintagesWithDelta[0];
  const lastVintage = vintagesWithDelta[vintagesWithDelta.length - 1];

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <History className="h-4 w-4 text-sky-500" />
            <span>Select Target Interval:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={presets.some(p => p.value === targetTime) ? targetTime : 'custom'}
              onChange={e => {
                if (e.target.value !== 'custom') {
                  setTargetTime(e.target.value);
                }
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {presets.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom Timestamp...</option>
            </select>

            <input
              type="text"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              placeholder="YYYY-MM-DDTHH:MM:SSZ"
              className="w-56 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <a
          href={exportUrl}
          download
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Vintages CSV</span>
        </a>
      </div>

      {isLoading && <LoadingSkeleton rows={5} />}

      {error && (
        <ErrorAlert
          message={(error as Error).message || 'Failed to fetch vintage forecasts'}
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Target Outturn Actual"
              value={data.actualGeneration}
              unit="MW"
              subValue={`${data.targetTimeUk} UK`}
              tooltip="Final actual wind generation for this half-hour settlement interval"
              variant="success"
            />
            <KPICard
              title="First Available Forecast"
              value={firstVintage?.forecastGeneration}
              unit="MW"
              subValue={`Published ${firstVintage?.horizonHours}h before delivery`}
              tooltip="Earliest numerical weather prediction run recorded for this period"
              variant="info"
            />
            <KPICard
              title="Final Gate Forecast"
              value={lastVintage?.forecastGeneration}
              unit="MW"
              subValue={`Error: ${lastVintage?.error !== null ? `${lastVintage.error > 0 ? '+' : ''}${lastVintage.error}` : '—'} MW`}
              tooltip="Latest forecast published immediately prior to delivery gate closure"
              variant="warning"
            />
            <KPICard
              title="Total Forecast Vintages"
              value={data.totalVintages}
              unit="runs"
              subValue="Evolution snapshots recorded"
              tooltip="Total number of successive model runs published by Elexon for this interval"
            />
          </div>

          {/* Evolution Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Forecast Evolution Trajectory vs Outturn Actual (MW)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Shows how successive forecasts evolved over time as delivery approached (left = long horizon, right = gate closure)
              </p>
            </div>

            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={vintagesWithDelta}
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="horizonHours"
                    tickFormatter={h => `${h}h`}
                    reversed
                    stroke="#888888"
                    fontSize={11}
                    tickLine={false}
                    label={{ value: 'Lead Time Horizon (Hours to Delivery)', position: 'bottom', offset: 0, fontSize: 11 }}
                  />
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
                            Published: {d.publishTimeUk} UK
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Horizon: {d.horizonHours} hours ahead
                          </div>
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between gap-4 text-sky-600">
                              <span>Forecast:</span>
                              <strong>{d.forecastGeneration?.toLocaleString()} MW</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-emerald-600">
                              <span>Actual Outturn:</span>
                              <strong>{d.actualGeneration?.toLocaleString()} MW</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-amber-600 border-t border-slate-100 dark:border-slate-800 pt-1">
                              <span>Miss (Error):</span>
                              <strong>{d.error > 0 ? `+${d.error}` : d.error} MW</strong>
                            </div>
                            {d.revision !== 0 && (
                              <div className="flex justify-between gap-4 text-slate-500 text-[10px]">
                                <span>Revision vs prev run:</span>
                                <span>{d.revision > 0 ? `+${d.revision}` : d.revision} MW</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />

                  {/* Horizontal Outturn Reference Line */}
                  {data.actualGeneration !== null && (
                    <ReferenceLine
                      y={data.actualGeneration}
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      name="Final Actual Generation (MW)"
                      label={{
                        value: `Actual: ${data.actualGeneration.toLocaleString()} MW`,
                        position: 'insideTopLeft',
                        fill: '#10b981',
                        fontSize: 11,
                      }}
                    />
                  )}

                  {/* Forecast Line */}
                  <Line
                    type="monotone"
                    dataKey="forecastGeneration"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0284c7' }}
                    activeDot={{ r: 6 }}
                    name="Forecast Vintage (MW)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Vintages History Table */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Detailed Forecast Vintage Chronology
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Full chronological sequence of every model run published for this interval
              </p>
            </div>

            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Publish Time (UK)</th>
                    <th className="p-3">Publish Time (UTC)</th>
                    <th className="p-3 text-right">Lead Horizon</th>
                    <th className="p-3 text-right">Forecast (MW)</th>
                    <th className="p-3 text-right">Error (MW)</th>
                    <th className="p-3 text-right">Step Revision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {vintagesWithDelta.map((row, idx) => {
                    const isOver = (row.error || 0) > 0;
                    return (
                      <tr
                        key={row.publishTime}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-sans text-slate-900 dark:text-slate-200">
                          {row.publishTimeUk}
                        </td>
                        <td className="p-3 text-slate-400">{row.publishTime}</td>
                        <td className="p-3 text-right font-semibold text-purple-600 dark:text-purple-400">
                          {row.horizonHours}h
                        </td>
                        <td className="p-3 text-right font-semibold text-sky-600 dark:text-sky-400">
                          {row.forecastGeneration.toLocaleString()}
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
                          {row.revision !== 0 ? (
                            <span className={row.revision > 0 ? 'text-amber-500' : 'text-sky-500'}>
                              {row.revision > 0 ? `+${row.revision}` : row.revision}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
