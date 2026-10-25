import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KPICard } from '../components/KPICard';

describe('KPICard Component', () => {
  it('renders title, formatted value and unit correctly', () => {
    render(
      <KPICard
        title="Peak Forecast"
        value={15834}
        unit="MW"
        subValue="At 12:00 UK"
      />
    );

    expect(screen.getByText('Peak Forecast')).toBeInTheDocument();
    expect(screen.getByText('15,834')).toBeInTheDocument();
    expect(screen.getByText('MW')).toBeInTheDocument();
    expect(screen.getByText('At 12:00 UK')).toBeInTheDocument();
  });

  it('renders fallback dash when value is null', () => {
    render(<KPICard title="Missing Metric" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('applies success variant styling', () => {
    const { container } = render(
      <KPICard title="Success Card" value={100} variant="success" />
    );
    const card = container.querySelector('[data-testid="kpi-card"]');
    expect(card?.className).toContain('border-emerald-500/30');
  });
});
