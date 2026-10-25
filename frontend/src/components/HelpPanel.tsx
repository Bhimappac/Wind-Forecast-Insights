import React from 'react';
import { X, BookOpen, AlertCircle, Compass } from 'lucide-react';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Trader's Guide & Metric Definitions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plain-language reference for UK day-ahead wind trading decisions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-6 text-sm text-slate-600 dark:text-slate-300">
          {/* Decision Time Logic */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-800">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 text-sm">
              <Compass className="h-4 w-4 text-sky-500" />
              Day-Ahead Decision Time Logic
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              UK power exchanges (EPEX SPOT / Nord Pool) clear day-ahead auctions before noon on D-1.
              Utility trading desks lock positions around <strong>09:00 UK local time on D-1</strong>.
              The app automatically identifies the newest forecast run published on or before your cutoff time,
              preventing hindsight bias.
            </p>
          </div>

          {/* Metric definitions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Forecast Error (<span className="font-mono text-sky-600 dark:text-sky-400">Forecast - Actual</span>)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                <strong>Positive error:</strong> Over-forecast (model expected more wind than produced; utility under-procured thermal/hydro).
                <br />
                <strong>Negative error:</strong> Under-forecast (wind beat expectations; utility over-procured).
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Mean Absolute Error (MAE)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Average magnitude of forecast error in MW, irrespective of direction. If MAE is 1,200 MW, you expect
                actual generation to differ from forecast by ~1,200 MW on average.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Root Mean Squared Error (RMSE)
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Penalizes large blunders quadratically. A large gap between RMSE and MAE indicates frequent tail-risk
                misses or sudden ramp mispredictions.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Mean Bias
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Signed average of errors. A positive bias (+1,500 MW) indicates the numerical weather prediction
                systematically over-estimates wind in January 2026.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Expected P90 Error Band
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Empirical 90th percentile of absolute errors at that forecast horizon. 9 out of 10 delivery periods
                land within <code>[Forecast - P90, Forecast + P90]</code>. Use this to size reserve hedges.
              </p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-900">
              <div className="font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Forecast Horizon
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Lead time: <code>startTime - publishTime</code> in hours. Shorter horizons (e.g. 4h) have significantly
                lower MAE than 40h horizons due to updated satellite and radar inputs.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 flex gap-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <strong>Timezone Note:</strong> Settlement periods run from 1 to 48 in London Local Time (Europe/London).
              In January, London is on GMT (UTC+0). All backend timestamps are strictly preserved in UTC.
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            Got it, return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
