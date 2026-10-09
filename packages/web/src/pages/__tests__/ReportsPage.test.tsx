import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { REPORT_SLUGS, type ReportIndexResponse } from '@naru/shared';
import { ReportsPage } from '../reports/ReportsPage';
import { reportsApi } from '../../api/reports';

vi.mock('../../api/reports', () => ({
  reportsApi: { listReports: vi.fn() },
}));

const mockUseAuthStore = vi.fn();
vi.mock('../../store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

const mockReportsApi = vi.mocked(reportsApi);
const index: ReportIndexResponse = {
  items: [
    ...REPORT_SLUGS.map(slug => ({
      slug,
      title: slug,
      description: 'Detailed server description.',
      available: true,
      note: null,
      chart: null,
    })),
    {
      slug: 'mobile-clinics',
      title: 'Mobile clinics',
      description: 'How many mobile clinics were held.',
      available: false,
      note: 'Needs event attendance.',
      chart: null,
    },
  ],
  total: 13,
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
    mockUseAuthStore.mockReturnValue({ user: { id: 1, role: 'ADMIN' }, lang: 'en' });
    mockReportsApi.listReports.mockResolvedValue(index);
  });

  it('groups all available reports in the intended order and preserves their destinations', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Program census at date' });
    expect(screen.getAllByRole('link')).toHaveLength(12);

    for (const [category, slugs] of [
      ['Enrollment & community', ['census', 'newcomers', 'demographics', 'incap-pairs']],
      ['Nutrition & outcomes', ['weight-change', 'transitions', 'graduations', 'evaluations']],
      ['Visits & support', ['attendance', 'visits-by-site', 'home-visits', 'resources']],
    ] as const) {
      const links = within(screen.getByRole('region', { name: category })).getAllByRole('link');
      expect(links.map(link => link.getAttribute('href'))).toEqual(slugs.map(slug => `/reports/${slug}`));
    }
    expect(screen.getByRole('link', { name: 'Entry vs exit weight' }))
      .toHaveAccessibleDescription('Compare admission and exit weight.');
  });

  it('keeps unavailable reports visible without a clickable link', async () => {
    renderPage();
    const title = await screen.findByRole('heading', { name: 'Mobile clinics' });
    expect(title.closest('a')).toBeNull();
    expect(screen.getByText('Coming later')).toBeInTheDocument();
    expect(title.closest('[aria-disabled="true"]')).toHaveAccessibleDescription(
      'Not available in V1 - it needs event attendance, which is not yet recorded.'
    );
  });

  it('searches names regardless of case, word order, and surrounding whitespace', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Find a report' });
    await user.type(search, '  WEIGHT entry  ');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Entry vs exit weight' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Enrollment & community' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 reports found');
  });

  it('searches descriptions and categories', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Find a report' });
    await user.type(search, 'supplies');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Resources distributed' })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'outcomes');
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('region', { name: 'Nutrition & outcomes' })).toBeInTheDocument();
  });

  it('shows no matches and restores the catalogue when search is cleared', async () => {
    const user = userEvent.setup();
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Find a report' });
    await user.type(search, 'no-such-report');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('No reports match your search. Try another name or category.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 reports found');
    await user.click(screen.getByRole('button', { name: 'Clear report search' }));
    expect(screen.getAllByRole('link')).toHaveLength(12);
    expect(search).toHaveFocus();
    expect(search).toHaveValue('');
  });

  it('includes unavailable reports in search results', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByRole('searchbox', { name: 'Find a report' }), 'mobile');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Mobile clinics' })).toBeInTheDocument();
    expect(screen.queryByText('No reports match your search. Try another name or category.')).not.toBeInTheDocument();
  });

  it('translates the catalogue and supports searching without Spanish accents', async () => {
    const user = userEvent.setup();
    mockUseAuthStore.mockReturnValue({ user: { id: 1, role: 'ADMIN' }, lang: 'es' });
    renderPage();
    const search = await screen.findByRole('searchbox', { name: 'Buscar un informe' });
    expect(screen.getByRole('heading', { level: 1, name: 'Informes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Nutrición y resultados' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Peso al ingreso y al egreso' }))
      .toHaveAccessibleDescription('Compara el peso al ingreso y al egreso.');
    await user.type(search, 'nutricion');
    expect(screen.getAllByRole('link')).toHaveLength(4);
    await user.clear(search);
    await user.type(search, 'clinicas');
    expect(screen.getByRole('heading', { name: 'Clínicas móviles' })).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
  });

  it('only shows reports returned by the API and preserves unfamiliar reports', async () => {
    mockReportsApi.listReports.mockResolvedValue({
      items: [{
        slug: 'new-report',
        title: 'A new report',
        description: 'An additional report from the server.',
        available: true,
        note: null,
        chart: null,
      }],
      total: 1,
    });
    renderPage();
    const link = await screen.findByRole('link', { name: 'A new report' });
    expect(link).toHaveAttribute('href', '/reports/new-report');
    expect(link).toHaveAccessibleDescription('An additional report from the server.');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Other reports' })).toBeInTheDocument();
  });

  it('shows the loading state while awaiting the catalogue', () => {
    mockReportsApi.listReports.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('shows an error banner when the index fails to load', async () => {
    mockReportsApi.listReports.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the report list.');
  });

  it('shows an empty state when no reports come back', async () => {
    mockReportsApi.listReports.mockResolvedValue({ items: [], total: 0 });
    renderPage();
    expect(await screen.findByText('No reports available.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
