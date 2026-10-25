import {
  ActualsResponse,
  LatestForecastResponse,
  VintagesResponse,
  AccuracySummaryResponse,
  HorizonAccuracyResponse,
  HourOfDayAccuracyResponse,
  DailyAccuracyResponse,
  HealthResponse,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    let errMsg = `Request failed: HTTP ${res.status}`;
    try {
      const errData = await res.json();
      if (errData?.detail) errMsg = errData.detail;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  getHealth: () => fetchJson<HealthResponse>('/api/health'),

  getActuals: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<ActualsResponse>(`/api/actuals?${params.toString()}`);
  },

  getLatestForecast: (deliveryDate: string, decisionTime?: string) => {
    const params = new URLSearchParams();
    params.set('delivery_date', deliveryDate);
    if (decisionTime) params.set('decision_time', decisionTime);
    return fetchJson<LatestForecastResponse>(`/api/forecast/latest?${params.toString()}`);
  },

  getForecastVintages: (targetTime: string) => {
    const params = new URLSearchParams();
    params.set('target_time', targetTime);
    return fetchJson<VintagesResponse>(`/api/forecast/vintages?${params.toString()}`);
  },

  getAccuracySummary: (from?: string, to?: string, minHorizon?: number, maxHorizon?: number) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (minHorizon !== undefined) params.set('min_horizon', minHorizon.toString());
    if (maxHorizon !== undefined) params.set('max_horizon', maxHorizon.toString());
    return fetchJson<AccuracySummaryResponse>(`/api/accuracy/summary?${params.toString()}`);
  },

  getAccuracyByHorizon: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<HorizonAccuracyResponse>(`/api/accuracy/by-horizon?${params.toString()}`);
  },

  getAccuracyByHour: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<HourOfDayAccuracyResponse>(`/api/accuracy/by-hour?${params.toString()}`);
  },

  getAccuracyByDay: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<DailyAccuracyResponse>(`/api/accuracy/by-day?${params.toString()}`);
  },

  getExportUrl: (params: Record<string, string | number | undefined | null>) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        sp.set(key, val.toString());
      }
    });
    return `${API_BASE}/api/export.csv?${sp.toString()}`;
  },
};
