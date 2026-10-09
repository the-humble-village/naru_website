import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WeightDelta from '../WeightDelta';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

describe('WeightDelta', () => {
  it('renders both weights and a positive delta in green when rising', () => {
    render(<WeightDelta from={58.2} to={63.1} />);

    expect(screen.getByText('58.2')).toBeInTheDocument();
    expect(screen.getByText('63.1')).toBeInTheDocument();
    expect(screen.getByText('+4.9')).toHaveClass('text-hv-green');
    expect(screen.getByText('weight.increased')).toBeInTheDocument();
  });

  it('renders a falling delta in crisis colour', () => {
    render(<WeightDelta from={63.1} to={58.2} />);

    expect(screen.getByText('-4.9')).toHaveClass('text-hv-crisis');
    expect(screen.getByText('weight.decreased')).toBeInTheDocument();
  });

  it('renders an unchanged delta neutrally', () => {
    render(<WeightDelta from={60} to={60} />);

    expect(screen.getByText('0.0')).toHaveClass('text-hv-gray');
    expect(screen.getByText('weight.unchanged')).toBeInTheDocument();
  });

  it('renders only the known value when one side is missing', () => {
    const { unmount } = render(<WeightDelta from={58.2} to={null} />);
    expect(screen.getByText('58.2')).toBeInTheDocument();
    expect(screen.queryByText(/^[+-]/)).not.toBeInTheDocument();
    unmount();

    render(<WeightDelta from={null} to={63.1} />);
    expect(screen.getByText('63.1')).toBeInTheDocument();
  });

  it('renders an em dash when both sides are missing', () => {
    render(<WeightDelta from={null} to={undefined} />);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('weight.no_data')).toBeInTheDocument();
  });

  it('uses the supplied unit', () => {
    render(<WeightDelta from={1} to={2} unit="lb" />);
    expect(screen.getByText('lb')).toBeInTheDocument();
  });
});
