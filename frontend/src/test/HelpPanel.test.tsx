import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HelpPanel } from '../components/HelpPanel';

describe('HelpPanel Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<HelpPanel isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders metric guide titles when open', () => {
    render(<HelpPanel isOpen={true} onClose={() => {}} />);

    expect(screen.getByText("Trader's Guide & Metric Definitions")).toBeInTheDocument();
    expect(screen.getByText('Mean Absolute Error (MAE)')).toBeInTheDocument();
    expect(screen.getByText('Root Mean Squared Error (RMSE)')).toBeInTheDocument();
    expect(screen.getByText('Expected P90 Error Band')).toBeInTheDocument();
    expect(screen.getByText('Forecast Horizon')).toBeInTheDocument();
  });

  it('triggers onClose when close button is clicked', () => {
    const onCloseMock = vi.fn();
    render(<HelpPanel isOpen={true} onClose={onCloseMock} />);

    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
