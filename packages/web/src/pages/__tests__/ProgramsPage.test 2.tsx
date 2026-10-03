import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getByText('admin.program_inactive')).toBeInTheDocument();
  });

  it('shows an empty state when there are no programs', async () => {
    vi.mocked(programsApi.listPrograms).mockResolvedValue({ items: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('admin.programs_empty')).toBeInTheDocument();
    });
  });

  it('shows a loading state while the programs load', () => {
    vi.mocked(programsApi.listPrograms).mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
