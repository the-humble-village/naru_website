import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t, type ReportColumn, type ReportRow } from '@naru/shared';
import { ReportChart, ReportTable } from '../reports/ReportTable';

vi.mock('../../hooks', () => ({
  useTranslation: () => ({ t: (key: Parameters<typeof t>[0]) => t(key, 'en'), lang: 'en' }),
}));
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: Parameters<typeof t>[0]) => t(key, 'en'), lang: 'en' }),
}));

// Inspect the series supplied to the chart independently of jsdom's zero-size layout.
vi.mock('recharts', () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container, BarChart: Container, LineChart: Container,
    Bar: ({ dataKey, fill, name }: { dataKey: string; fill: string; name: string }) =>
      <div data-testid={`series-${dataKey}`} data-fill={fill}>{name}</div>,
    Line: () => null, XAxis: () => null, YAxis: () => null,
    CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
  };
});

const columns: ReportColumn[] = [
  { key: 'fromStatus', label: 'From', type: 'string' },
  { key: 'toStatus', label: 'To', type: 'string' },
  { key: 'transitions', label: 'Transitions', type: 'number' },
];

describe('nutrition report colors', () => {
  it('keeps each status color when rows reorder or filtering removes other statuses', () => {
    const cases = [
      ['NORMAL', '#64748b', 'Normal'], ['MILD', '#16a34a', 'Mild'],
      ['SEVERE', '#dc2626', 'Severe'], ['MODERATE', '#eab308', 'Moderate'],
    ];
    const rows: ReportRow[] = cases.map(([status]) => ({ fromStatus: 'NORMAL', toStatus: status!, transitions: 4 }));
    const view = render(<ReportChart slug="transitions" chart="bar" columns={columns} rows={rows} />);
    for (const [status, color, label] of cases) {
      expect(screen.getByTestId(`series-${status}`)).toHaveAttribute('data-fill', color);
      expect(screen.getByTestId(`series-${status}`)).toHaveTextContent(label!);
    }
    expect(screen.getAllByTestId(/^series-/).map(node => node.textContent)).toEqual(['Severe', 'Moderate', 'Mild', 'Normal']);
    for (const [status, color] of cases) {
      view.rerender(<ReportChart slug="transitions" chart="bar" columns={columns}
        rows={[{ fromStatus: 'MILD', toStatus: status!, transitions: 2 }]} />);
      expect(screen.getAllByTestId(/^series-/)).toHaveLength(1);
      expect(screen.getByTestId(`series-${status}`)).toHaveAttribute('data-fill', color);
    }
  });

  it('uses the same palette in desktop report cells and mobile report cards', () => {
    render(<ReportTable slug="transitions" columns={columns} rows={[
      { fromStatus: 'SEVERE', toStatus: 'MODERATE', transitions: 3 },
      { fromStatus: 'MILD', toStatus: 'NORMAL', transitions: 2 },
    ]} />);
    for (const [label, background, foreground] of [
      ['Severe', 'bg-red-100', 'text-red-800'],
      ['Moderate', 'bg-yellow-100', 'text-yellow-900'],
      ['Mild', 'bg-green-100', 'text-green-800'],
      ['Normal', 'bg-slate-100', 'text-slate-700'],
    ]) {
      const badges = screen.getAllByText(label!);
      expect(badges).toHaveLength(2);
      badges.forEach(badge => expect(badge).toHaveClass(background!, foreground!));
    }
  });

  it('preserves missing statuses and does not treat unrelated text as nutrition data', () => {
    render(<ReportTable slug="mother-infant-pairs" columns={[
      { key: 'latestStatus', label: 'Latest status', type: 'string' },
      { key: 'siteName', label: 'Site', type: 'string' },
    ]} rows={[{ latestStatus: null, siteName: 'MILD' }]} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
    screen.getAllByText('MILD').forEach(cell => expect(cell).not.toHaveAttribute('data-nutrition-status'));
  });
});
