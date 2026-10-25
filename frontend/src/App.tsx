import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { HelpPanel } from './components/HelpPanel';
import { DecisionView } from './pages/DecisionView';
import { AccuracyView } from './pages/AccuracyView';
import { EvolutionView } from './pages/EvolutionView';
import { useUrlState } from './hooks/useUrlState';
import { api } from './api/client';

export function App() {
  const {
    tab,
    setTab,
    deliveryDate,
    setDeliveryDate,
    decisionTime,
    setDecisionTime,
    targetTime,
    setTargetTime,
  } = useUrlState();

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={tab}
        onTabChange={setTab}
        onOpenHelp={() => setIsHelpOpen(true)}
        health={health}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {tab === 'decision' && (
          <DecisionView
            deliveryDate={deliveryDate}
            setDeliveryDate={setDeliveryDate}
            decisionTime={decisionTime}
            setDecisionTime={setDecisionTime}
          />
        )}

        {tab === 'accuracy' && <AccuracyView />}

        {tab === 'evolution' && (
          <EvolutionView
            targetTime={targetTime}
            setTargetTime={setTargetTime}
          />
        )}
      </main>

      {/* Help Modal */}
      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-navy-900/50 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>Wind Forecast Insights</strong> • UK Day-Ahead Power Trading Desk
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Data: Elexon BMRS (FUELHH + WINDFOR)</span>
            <span>•</span>
            <span>Delivery: January 1–31, 2026</span>
            <span>•</span>
            <span className="text-slate-400 dark:text-slate-500">
              Developed with assistance from Google Antigravity
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
