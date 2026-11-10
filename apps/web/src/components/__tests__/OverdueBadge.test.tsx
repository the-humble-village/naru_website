import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OverdueBadge from '../OverdueBadge';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const daysAgo = (n: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

describe('OverdueBadge', () => {
  it('renders the day count since the last visit', () => {
    render(<OverdueBadge lastVisitDate={daysAgo(4)} intervalDays={30} />);

    const badge = screen.getByText(/4/);
    expect(badge).toHaveTextContent('4overdue.day_suffix');
    expect(badge).toHaveClass('text-hv-gray');
  });

  it('flags the count in crisis colour once the interval is exceeded', () => {
    render(<OverdueBadge lastVisitDate={daysAgo(34)} intervalDays={30} />);

    const badge = screen.getByText(/34/);
    expect(badge).toHaveClass('text-hv-crisis', 'font-semibold');
    expect(screen.getByText('overdue.overdue')).toBeInTheDocument();
    expect(badge).toHaveTextContent('⚠');
  });

  it('never flags overdue when the program has no interval', () => {
    render(<OverdueBadge lastVisitDate={daysAgo(400)} intervalDays={null} />);

    const badge = screen.getByText(/400/);
    expect(badge).toHaveClass('text-hv-gray');
    expect(screen.queryByText('overdue.overdue')).not.toBeInTheDocument();
  });

  it('is not overdue exactly on the interval boundary', () => {
    render(<OverdueBadge lastVisitDate={daysAgo(30)} intervalDays={30} />);

    expect(screen.getByText(/30/)).toHaveClass('text-hv-gray');
  });

  it('says so when there is no last visit at all', () => {
    render(<OverdueBadge lastVisitDate={null} intervalDays={30} />);

    expect(screen.getByText('overdue.no_visits')).toBeInTheDocument();
    expect(screen.queryByText('overdue.overdue')).not.toBeInTheDocument();
  });

  it('accepts a full ISO timestamp', () => {
    render(<OverdueBadge lastVisitDate={`${daysAgo(2)}T10:30:00.000Z`} intervalDays={30} />);

    expect(screen.getByText(/2/)).toHaveTextContent('2overdue.day_suffix');
  });
});
