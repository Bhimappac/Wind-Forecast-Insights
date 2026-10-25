import { useState, useEffect, useCallback } from 'react';

export function useUrlState() {
  const getParams = () => new URLSearchParams(window.location.search);

  const [tab, setTabState] = useState<string>(() => getParams().get('tab') || 'decision');
  const [deliveryDate, setDeliveryDateState] = useState<string>(() => getParams().get('date') || '2026-01-15');
  const [decisionTime, setDecisionTimeState] = useState<string>(() => getParams().get('decision') || '09:00');
  const [targetTime, setTargetTimeState] = useState<string>(() => getParams().get('target') || '2026-01-15T12:00:00Z');

  const updateUrl = useCallback((newParams: Record<string, string>) => {
    const sp = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    const newUrl = `${window.location.pathname}?${sp.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  const setTab = (newTab: string) => {
    setTabState(newTab);
    updateUrl({ tab: newTab, date: deliveryDate, decision: decisionTime, target: targetTime });
  };

  const setDeliveryDate = (newDate: string) => {
    setDeliveryDateState(newDate);
    updateUrl({ tab, date: newDate, decision: decisionTime, target: targetTime });
  };

  const setDecisionTime = (newTime: string) => {
    setDecisionTimeState(newTime);
    updateUrl({ tab, date: deliveryDate, decision: newTime, target: targetTime });
  };

  const setTargetTime = (newTarget: string) => {
    setTargetTimeState(newTarget);
    updateUrl({ tab, date: deliveryDate, decision: decisionTime, target: newTarget });
  };

  useEffect(() => {
    const handlePop = () => {
      const sp = getParams();
      if (sp.has('tab')) setTabState(sp.get('tab')!);
      if (sp.has('date')) setDeliveryDateState(sp.get('date')!);
      if (sp.has('decision')) setDecisionTimeState(sp.get('decision')!);
      if (sp.has('target')) setTargetTimeState(sp.get('target')!);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  return {
    tab,
    setTab,
    deliveryDate,
    setDeliveryDate,
    decisionTime,
    setDecisionTime,
    targetTime,
    setTargetTime,
  };
}
