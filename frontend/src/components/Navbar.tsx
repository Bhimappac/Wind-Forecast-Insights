import React from 'react';
import { Wind, Moon, Sun, HelpCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { HealthResponse } from '../api/types';

interface NavbarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenHelp: () => void;
  health?: HealthResponse;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenHelp,
  health,
}) => {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'decision', label: 'Decision View', badge: 'D-1 Auction' },
    { id: 'accuracy', label: 'Forecast Accuracy', badge: 'Error Analytics' },
    { id: 'evolution', label: 'Forecast Evolution', badge: 'Vintages' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-navy-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 text-white shadow-md shadow-sky-500/20">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Wind Forecast Insights
              </span>
              <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-300/40">
                UK Day-Ahead
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              National Grid ESO / Elexon BMRS • January 2026
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1 border border-slate-200 dark:border-slate-800">
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Health indicator badge */}
          {health && (
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 text-[11px] font-mono text-slate-600 dark:text-slate-400"
              title={`Loaded ${health.actualsLoaded} actuals and ${health.forecastsLoaded} forecasts`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  health.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>18.1k snapshots</span>
            </div>
          )}

          {/* Help button */}
          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <HelpCircle className="h-4 w-4 text-sky-500" />
            <span className="hidden sm:inline">How to read this</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile tabs row */}
      <div className="flex md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-2 overflow-x-auto gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === t.id
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </header>
  );
};
