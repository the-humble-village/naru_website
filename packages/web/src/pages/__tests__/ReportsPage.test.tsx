import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReportIndexResponse } from '@naru/shared';
import { ReportsPage } from '../reports/ReportsPage';
import { reportsApi } from '../../api/reports';

vi.mock('../../api/reports', () => ({
  reportsApi: {
    listReports: vi.fn(),
    fetchReport: vi.fn(),
    exportReport: vi.fn(),
    downloadReport: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'ADMIN' }, lang: 'en' }),
}));

const mockReportsApi = vi.mocked(reportsApi);

const index: ReportIndexResponse = {
  items: [
    {
      slug: 'census',
      title: 'Program census at date',
      description: 'How many subjects were enrolled on a given date.',
      available: true,
      note: null,
      chart: 'line',
    },
    {
      slug: 'visits-by-site',
      title: 'Visits per site',
      description: 'Total visits recorded at each site.',
      available: true,
      note: null,
      chart: null,
    },
    {
      slug: 'mobile-clinics',
      title: 'Mobile clinics',
      description: 'How many mobile clinics were held.',
      available: false,
      note: 'Not available in V1 — it needs event attendance.',
      chart: null,
    },
  ],
  total: 3,
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportsApi.listReports.mockResolvedValue(index);
  });

  it('renders a card for every report the API returns', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Program census at date')).toBeInTheDocument();
    });
    expect(screen.getByText('Visits per site')).toBeInTheDocument();
    expect(screen.getByText('Mobile clinics')).toBeInTheDocument();
    expect(screen.getByText('Total visits recorded at each site.')).toBeInTheDocument();
  });

  it('links available reports to their slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Program census at date')).toBeInTheDocument();
    });
    expect(screen.getByText('Program census at date').closest('a')).toHaveAttribute(
      'href',
      '/reports/census'
    );
    expect(screen.getByText('Visits per site').closest('a')).toHaveAttribute(
      'href',
      '/reports/visits-by-site'
    );
  });

  it('shows the deferred report as a disabled card rather than hiding it', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Mobile clinics')).toBeInTheDocument();
    });

    expect(screen.getByText('Mobile clinics').closest('a')).toBeNull();
    expect(screen.getByText('reports.coming_future')).toBeInTheDocument();
    expect(
      screen.getByText('Not available in V1 — it needs event attendance.')
    ).toBeInTheDocument();

    const card = screen.getByText('Mobile clinics').closest('[aria-disabled="true"]');
    expect(card).not.toBeNull();
  });

  it('shows an error banner when the index fails to load', async () => {
    mockReportsApi.listReports.mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('reports.load_failed')).toBeInTheDocument();
    });
  });

  it('shows an empty state when no reports come back', async () => {
    mockReportsApi.listReports.mockResolvedValue({ items: [], total: 0 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('reports.empty')).toBeInTheDocument();
    });
  });
});
