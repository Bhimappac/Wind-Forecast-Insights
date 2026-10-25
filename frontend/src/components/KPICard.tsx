import React from 'react';
import { HelpCircle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number | null | undefined;
  unit?: string;
  subValue?: string;
  tooltip?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  subValue,
  tooltip,
  icon,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'warning':
        return 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20';
      case 'info':
        return 'border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20';
      default:
        return 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80';
    }
  };

  const formattedValue = value !== null && value !== undefined ? value.toLocaleString() : '—';

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${getVariantStyles()}`}
      data-testid="kpi-card"
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5 uppercase tracking-wider">
          {title}
          {tooltip && (
            <span className="relative group cursor-help">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 rounded bg-slate-900 dark:bg-slate-800 p-2 text-center text-xs text-slate-100 shadow-lg z-50 normal-case font-normal">
                {tooltip}
              </span>
            </span>
          )}
        </span>
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-mono">
          {formattedValue}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>

      {subValue && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
          {subValue}
        </div>
      )}
    </div>
  );
};
