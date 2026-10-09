import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProgramsPage } from '../programs/ProgramsPage';
import { programsApi } from '../../api/programs';
import type { ProgramRead } from '@naru/shared';

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', async () => {
  const { t } = await import('@naru/shared');
  return {
    useTranslation: () => ({
      t: (key: Parameters<typeof t>[0]) => t(key, 'en'),
      lang: 'en',
    }),
  };
});

const base = {
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const programs: Array<ProgramRead & { activeEnrollmentCount: number }> = [
  {
    ...base,
    id: 1,
    name: 'Expectant Mother',
    kind: 'PREGNANCY',
    subjectType: 'MOTHER',
    active: true,
    activeEnrollmentCount: 42,
  },
  {
    ...base,
    id: 2,
    name: 'Nutrition Infant',
    kind: 'NUTRITION',
    subjectType: 'CHILD',
    active: true,
    activeEnrollmentCount: 31,
  },
  {
    ...base,
    id: 3,
    name: 'Retired Youth',
    kind: 'STUDENT',
    subjectType: 'PERSON',
    active: false,
    visitIntervalDays: null,
    activeEnrollmentCount: 0,
  },
];

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProgramsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ProgramsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(programsApi.listPrograms).mockResolvedValue({
      items: programs,
      total: programs.length,
    });
  });

  it('renders a card per program with its active enrollment count', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Expectant Mother')).toBeInTheDocument();
    });

    expect(screen.getByText('Nutrition Infant')).toBeInTheDocument();
    expect(screen.getByText('Retired Youth')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
  });

  it('keeps every program and its live count in the appropriate care group', async () => {
    const additional: Array<ProgramRead & { activeEnrollmentCount: number }> = [
      { ...base, id: 4, name: 'New nutrition program', kind: 'NUTRITION', subjectType: 'CHILD', active: true, activeEnrollmentCount: 17 },
      { ...base, id: 5, name: 'Midwives', kind: 'MIDWIFE', subjectType: 'PERSON', active: true, activeEnrollmentCount: 9 },
      { ...base, id: 6, name: 'Family support', kind: 'FAMILY_PAF', subjectType: 'FAMILY', active: true, activeEnrollmentCount: 6 },
    ];
    const all = [...programs, ...additional];
    vi.mocked(programsApi.listPrograms).mockResolvedValue({ items: all, total: all.length });
    renderPage();
    await screen.findByRole('region', { name: 'Maternal care' });
    const namesIn = (name: string) => within(screen.getByRole('region', { name }))
      .getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
    expect(namesIn('Maternal care')).toEqual(['Expectant Mother', 'Midwives']);
    expect(namesIn('Child nutrition')).toEqual(['Nutrition Infant', 'New nutrition program']);
    expect(namesIn('Community support')).toEqual(['Retired Youth', 'Family support']);
    expect(screen.getAllByRole('link')).toHaveLength(all.length);
    for (const program of all) {
      const link = screen.getByRole('link', { name: program.name });
      expect(link).toHaveAttribute('href', '/programs/' + program.id);
      expect(link).toHaveAccessibleDescription(expect.stringContaining(program.activeEnrollmentCount + ' Active enrollments'));
    }
  });

  it('links each card to its roster', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Expectant Mother')).toBeInTheDocument();
    });

    const link = screen.getByText('Expectant Mother').closest('a');
    expect(link).toHaveAttribute('href', '/programs/1');
  });

  it('shows inactive programs rather than hiding them', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Retired Youth')).toBeInTheDocument();
    });

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows an empty state when there are no programs', async () => {
    vi.mocked(programsApi.listPrograms).mockResolvedValue({ items: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No programs yet. Create the first one to get started.')).toBeInTheDocument();
    });
  });

  it('shows a loading state while the programs load', () => {
    vi.mocked(programsApi.listPrograms).mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
