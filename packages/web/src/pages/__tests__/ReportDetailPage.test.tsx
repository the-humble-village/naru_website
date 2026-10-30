import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ReportIndexResponse, ReportResponse } from '@naru/shared';
import { ReportDetailPage } from '../reports/ReportDetailPage';
import { reportsApi } from '../../api/reports';
import { adminApi } from '../../api/admin';
import { programsApi } from '../../api/programs';

vi.mock('../../api/reports', () => ({
  reportsApi: {
    listReports: vi.fn(),
    fetchReport: vi.fn(),
    exportReport: vi.fn(),
    downloadReport: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchSites: vi.fn(),
    fetchCommunities: vi.fn(),
  },
}));

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'ADMIN' }, lang: 'en' }),
}));

const mockReportsApi = vi.mocked(reportsApi);
const mockAdminApi = vi.mocked(adminApi);
const mockProgramsApi = vi.mocked(programsApi);

const index: ReportIndexResponse = {
  items: [
    {
      slug: 'visits-by-site',
      title: 'Visits per site',
      description: 'Total visits recorded at each site.',
      available: true,
      note: null,
      chart: null,
    },
    {
      slug: 'newcomers',
      title: 'Newcomers per month',
      description: 'New enrollments per calendar month, by site.',
      available: true,
      note: null,
      chart: 'line',
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

const visitsReport: ReportResponse = {
  slug: 'visits-by-site',
  title: 'Visits per site',
  columns: [
    { key: 'siteName', label: 'Site', type: 'string' },
    { key: 'visits', label: 'Visits', type: 'number' },
    { key: 'subjects', label: 'Subjects', type: 'number' },
  ],
  rows: [
    { siteId: 1, siteName: 'Xelaju', visits: 12, subjects: 9 },
    { siteId: 2, siteName: 'Nebaj', visits: 4, subjects: null },
  ],
  total: 2,
};

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
};

const renderPage = (path: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/reports/:slug" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportsApi.listReports.mockResolvedValue(index);
    mockReportsApi.fetchReport.mockResolvedValue(visitsReport);
    mockReportsApi.downloadReport.mockResolvedValue(undefined);
    mockAdminApi.fetchSites.mockResolvedValue([
      { id: 1, title: 'Xelaju', sortOrder: 0 },
      { id: 2, title: 'Nebaj', sortOrder: 1 },
    ] as unknown as Awaited<ReturnType<typeof adminApi.fetchSites>>);
    mockAdminApi.fetchCommunities.mockResolvedValue([
      { id: 10, title: 'La Union', siteId: 1 },
    ] as unknown as Awaited<ReturnType<typeof adminApi.fetchCommunities>>);
    mockProgramsApi.listPrograms.mockResolvedValue({
      items: [{ id: 5, name: 'Nutrition' }],
      total: 1,
    } as unknown as Awaited<ReturnType<typeof programsApi.listPrograms>>);
  });

  it('renders the report columns and rows', async () => {
    renderPage('/reports/visits-by-site');

    await waitFor(() => {
      expect(screen.getAllByText('Site').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Visits').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Subjects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Xelaju').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  it('renders a null cell as an em dash', async () => {
    renderPage('/reports/visits-by-site');

    await waitFor(() => {
      expect(screen.getAllByText('reports.row_count').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('sends the filters from the URL to the API', async () => {
    renderPage('/reports/visits-by-site?from=2026-01-01&to=2026-06-30&siteId=2&programId=5');

    await waitFor(() => {
      expect(mockReportsApi.fetchReport).toHaveBeenCalledWith('visits-by-site', {
        from: '2026-01-01',
        to: '2026-06-30',
        asOf: undefined,
        siteId: 2,
        programId: 5,
        communityId: undefined,
      });
    });

    expect((screen.getByLabelText('filter.date_from') as HTMLInputElement).value).toBe('2026-01-01');
    expect((screen.getByLabelText('filter.site') as HTMLSelectElement).value).toBe('2');
  });

  it('writes an applied filter into the URL query string', async () => {
    renderPage('/reports/visits-by-site');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Xelaju' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('filter.site'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('filter.date_from'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByText('filter.apply'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toContain('siteId=1');
    });
    expect(screen.getByTestId('location').textContent).toContain('from=2026-02-01');

    await waitFor(() => {
      expect(mockReportsApi.fetchReport).toHaveBeenLastCalledWith(
        'visits-by-site',
        expect.objectContaining({ siteId: 1, from: '2026-02-01' })
      );
    });
  });

  it('exports with the same filters that are applied', async () => {
    renderPage('/reports/visits-by-site?siteId=2');

    await waitFor(() => {
      expect(screen.getByText('reports.export_csv')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('reports.export_csv')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('reports.export_csv'));

    await waitFor(() => {
      expect(mockReportsApi.downloadReport).toHaveBeenCalledWith(
        'visits-by-site',
        expect.objectContaining({ siteId: 2 })
      );
    });
  });

  it('shows the deferred message for the unavailable report without calling the API', async () => {
    renderPage('/reports/mobile-clinics');

    await waitFor(() => {
      expect(screen.getByText('reports.coming_future')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Not available in V1 — it needs event attendance.')
    ).toBeInTheDocument();
    expect(mockReportsApi.fetchReport).not.toHaveBeenCalled();
  });

  it('shows the deferred message when the server answers 501', async () => {
    mockReportsApi.listReports.mockResolvedValue({ items: [], total: 0 });
    mockReportsApi.fetchReport.mockRejectedValue({ response: { status: 501 } });

    renderPage('/reports/mobile-clinics');

    await waitFor(() => {
      expect(screen.getByText('reports.coming_future')).toBeInTheDocument();
    });
  });

  it('shows a not-found message for an unknown slug', async () => {
    mockReportsApi.listReports.mockResolvedValue({ items: [], total: 0 });
    mockReportsApi.fetchReport.mockRejectedValue({ response: { status: 404 } });

    renderPage('/reports/nope');

    await waitFor(() => {
      expect(screen.getByText('reports.not_found')).toBeInTheDocument();
    });
  });

  it('shows an empty state when the report has no rows', async () => {
    mockReportsApi.fetchReport.mockResolvedValue({ ...visitsReport, rows: [], total: 0 });

    renderPage('/reports/visits-by-site');

    await waitFor(() => {
      expect(screen.getByText('reports.empty_rows')).toBeInTheDocument();
    });
  });

  it('renders a chart for a report the index marks as charted', async () => {
    mockReportsApi.fetchReport.mockResolvedValue({
      slug: 'newcomers',
      title: 'Newcomers per month',
      columns: [
        { key: 'month', label: 'Month', type: 'string' },
        { key: 'siteName', label: 'Site', type: 'string' },
        { key: 'newcomers', label: 'Newcomers', type: 'number' },
      ],
      rows: [
        { month: '2026-01', siteId: 1, siteName: 'Xelaju', newcomers: 3 },
        { month: '2026-02', siteId: 1, siteName: 'Xelaju', newcomers: 5 },
      ],
      total: 2,
    });

    renderPage('/reports/newcomers');

    await waitFor(() => {
      expect(screen.getByText('reports.chart')).toBeInTheDocument();
    });
    expect(screen.getAllByText('2026-01').length).toBeGreaterThan(0);
  });
});
