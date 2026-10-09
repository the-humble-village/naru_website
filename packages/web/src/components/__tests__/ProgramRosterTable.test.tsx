import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProgramRosterTable, { formatSubjectAge } from '../ProgramRosterTable';
import type { RosterRow } from '../ProgramRosterTable';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const yearsAgo = (years: number): string => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
};

const row = (overrides: Partial<RosterRow> = {}): RosterRow => ({
  enrollmentId: 1,
  subjectName: 'María López',
  subjectHref: '/mothers/1',
  birthDate: yearsAgo(28),
  communityName: 'Xela',
  entryWeight: 58.2,
  latestWeight: 63.1,
  lastVisitDate: daysAgo(4),
  ...overrides,
});

const renderTable = (props: Partial<React.ComponentProps<typeof ProgramRosterTable>> = {}) =>
  render(
    <MemoryRouter>
      <ProgramRosterTable kind="PREGNANCY" rows={[row()]} visitIntervalDays={30} {...props} />
    </MemoryRouter>
  );

const headers = (): string[] =>
  screen.getAllByRole('columnheader').map((cell) => cell.textContent ?? '');

describe('ProgramRosterTable', () => {
  it('renders the pregnancy column set', () => {
    renderTable({
      rows: [row({ gestationMonths: 7, dueDate: '2026-11-15' })],
    });

    expect(headers()).toEqual([
      'roster.member',
      'roster.community',
      'roster.weightroster.entry_latest',
      'roster.gestation',
      'roster.due',
      'roster.last_visit',
      'common.col_actions',
    ]);
    expect(screen.getAllByText('15/11/2026').length).toBeGreaterThan(0);
  });

  it('renders the nutrition column set with the persisted status badge', () => {
    renderTable({
      kind: 'NUTRITION',
      rows: [row({ nutritionalStatus: 'SEVERE', birthDate: daysAgo(120) })],
    });

    expect(headers()).toContain('roster.nutrition_status');
    expect(headers()).not.toContain('roster.gestation');
    expect(screen.getAllByText('nutritional_status.severe').length).toBeGreaterThan(0);
  });

  it('renders the midwife column set', () => {
    renderTable({ kind: 'MIDWIFE', rows: [row({ mothersAssigned: 12 })] });

    expect(headers()).toContain('roster.mothers_assigned');
    expect(headers()).not.toContain('roster.weight');
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('renders the student column set', () => {
    renderTable({ kind: 'STUDENT', rows: [row({ school: 'Escuela Xela', classYear: '3' })] });

    expect(headers()).toContain('roster.school');
    expect(headers()).toContain('roster.year');
    expect(screen.getAllByText('Escuela Xela').length).toBeGreaterThan(0);
  });

  it('renders the family column set without an age column', () => {
    renderTable({ kind: 'FAMILY_PAF', rows: [row({ memberCount: 5 })] });

    expect(headers()).toEqual([
      'roster.family_name',
      'roster.community',
      'roster.members',
      'roster.last_visit',
      'common.col_actions',
    ]);
  });

  it('links each active row to the enrollment-scoped visit form', () => {
    renderTable({ rows: [row({ enrollmentId: 42 })] });

    screen.getAllByRole('link', { name: 'roster.add_visit' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/enrollments/42/visits/new');
    });
  });

  it('swaps the last two columns and drops + Visit on the exited variant', () => {
    renderTable({
      variant: 'exited',
      rows: [row({ exitedAt: '2025-06-01', exitReason: 'GRADUATED' })],
    });

    expect(headers()).toContain('roster.exited');
    expect(headers()).toContain('roster.reason');
    expect(headers()).not.toContain('roster.last_visit');
    expect(screen.queryByRole('link', { name: 'roster.add_visit' })).not.toBeInTheDocument();
    expect(screen.getAllByText('exit_reason.graduated').length).toBeGreaterThan(0);
  });

  it('only offers visits for active records on the All tab', () => {
    renderTable({ variant: 'all', rows: [
      row({ enrollmentId: 1 }),
      row({ enrollmentId: 2, subjectName: 'Exited member', exitedAt: '2025-06-01', exitReason: 'GRADUATED' }),
    ] });
    const links = screen.getAllByRole('link', { name: 'roster.add_visit' });
    expect(links).toHaveLength(2); // Desktop and mobile renderings of the active record.
    links.forEach(link => expect(link).toHaveAttribute('href', '/enrollments/1/visits/new'));
    expect(screen.getAllByText('enrollment.exited · 1/6/2025')).toHaveLength(2);
  });

  it('keeps a missing latest weight distinct from a recorded zero', () => {
    renderTable({ rows: [row({ entryWeight: 0, latestWeight: null })] });
    const weight = screen.getByRole('table').querySelector('tbody tr td:nth-child(3)');
    expect(weight?.textContent).toContain('0.0');
    expect(weight?.textContent).toContain('—');
    expect(weight?.textContent).toContain('kg');
  });

  it('derives age as months for infants and years for adults', () => {
    expect(formatSubjectAge(daysAgo(120))).toBe('3m');
    expect(formatSubjectAge(yearsAgo(28))).toMatch(/^2[78]y$/);
    expect(formatSubjectAge(null)).toBeNull();
    expect(formatSubjectAge('not-a-date')).toBeNull();
  });

  it('renders a card fallback for small screens alongside the table', () => {
    const { container } = renderTable({ rows: [row({ enrollmentId: 7 })] });

    const cards = container.querySelector('.md\\:hidden');
    expect(cards).not.toBeNull();
    expect(container.querySelector('.hidden.md\\:block')).not.toBeNull();

    const card = cards as HTMLElement;
    expect(within(card).getByRole('link', { name: 'María López' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'roster.add_visit' })).toHaveClass('w-full');
  });

  it('renders an empty state and a loading state', () => {
    const { unmount } = renderTable({ rows: [] });
    expect(screen.getByText('roster.empty')).toBeInTheDocument();
    unmount();

    renderTable({ isLoading: true, rows: [] });
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });
});
