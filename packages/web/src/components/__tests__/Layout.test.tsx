import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Layout from '../Layout';
import { programsApi } from '../../api/programs';
import { dashboardApi } from '../../api/dashboard';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/programs', () => ({
  programsApi: { listPrograms: vi.fn() },
}));

vi.mock('../../api/dashboard', () => ({
  dashboardApi: { fetchUnenrolledCount: vi.fn() },
}));

vi.mock('../../api/search', () => ({
  searchApi: { searchByName: vi.fn() },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockListPrograms = programsApi.listPrograms as unknown as ReturnType<typeof vi.fn>;
const mockUnenrolledCount = dashboardApi.fetchUnenrolledCount as unknown as ReturnType<typeof vi.fn>;
const mockAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const setRole = (role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER') => {
  mockAuthStore.mockReturnValue({
    user: { id: 1, firstName: 'Caleb', lastName: 'Rowley', role },
    logout: vi.fn(),
    lang: 'en',
  });
};

const program = (id: number, name: string) => ({
  id,
  name,
  kind: 'NUTRITION' as const,
  subjectType: 'CHILD' as const,
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderLayout = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Layout sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('CASEWORKER');
    mockListPrograms.mockResolvedValue({ items: [], total: 0 });
    mockUnenrolledCount.mockResolvedValue({ children: 0, mothers: 0, people: 0, families: 0, total: 0 });
  });

  it('renders a link for every active program returned by the API', async () => {
    mockListPrograms.mockResolvedValue({
      items: [program(1, 'Expectant Mother'), program(2, 'Nutrition Infant')],
      total: 2,
    });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Expectant Mother' })).toHaveAttribute('href', '/programs/1');
    });
    expect(screen.getByRole('link', { name: 'Nutrition Infant' })).toHaveAttribute('href', '/programs/2');
    expect(mockListPrograms).toHaveBeenCalledWith({ activeOnly: true });
  });

  it('shows an empty state when no programs exist', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('No programs yet')).toBeInTheDocument();
    });
  });

  it('shows the unenrolled badge with its count', async () => {
    mockUnenrolledCount.mockResolvedValue({ children: 30, mothers: 5, people: 2, families: 1, total: 38 });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByText('38')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Unenrolled/ })).toHaveAttribute('href', '/unenrolled');
  });

  it('hides the unenrolled link when the count is zero', async () => {
    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: /Unenrolled/ })).not.toBeInTheDocument();
  });

  it('hides Admin from a caseworker and shows it to a supervisor', async () => {
    renderLayout();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();

    setRole('SUPERVISOR');
    renderLayout();
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Admin' }).length).toBeGreaterThan(0);
    });
  });
});
