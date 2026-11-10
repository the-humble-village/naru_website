import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import VisitsPage from '../visits/VisitsPage';
import { visitsApi } from '../../api/visits';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';

const mockAuth = vi.fn();
vi.mock('../../store/auth', () => ({ useAuthStore: () => mockAuth() }));

vi.mock('../../api/visits', () => ({ visitsApi: { listVisits: vi.fn() } }));
vi.mock('../../api/programs', () => ({ programsApi: { listPrograms: vi.fn() } }));
vi.mock('../../api/admin', () => ({
  adminApi: { fetchSites: vi.fn(), fetchCommunities: vi.fn() },
}));

const STAMP = '2026-01-01T00:00:00.000Z';

const VISIT = {
  id: 77,
  localId: null,
  enrollmentId: 12,
  visitDate: '2026-09-04',
  locationType: 'HOME' as const,
  siteId: 1,
  communityId: 2,
  recordedById: 1,
  eventId: null,
  notes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
  resources: [],
  trainingIds: [],
  answers: [],
  nutritionDetail: {
    weight: 6.5,
    height: 620,
    armCircumference: 118,
    weightForAgeZ: -2.4,
    heightForAgeZ: null,
    weightForHeightZ: null,
    muacZ: -2.1,
    nutritionalStatus: 'MODERATE' as const,
  },
  program: {
    id: 3,
    name: 'Nutrition',
    kind: 'NUTRITION' as const,
    subjectType: 'CHILD' as const,
  },
  subjectName: 'Jose Lopez',
  recordedByName: 'Ana Perez',
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockList = visitsApi.listVisits as ReturnType<typeof vi.fn>;

describe('VisitsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 1, role: 'CASEWORKER' }, lang: 'en' });
    mockList.mockResolvedValue({ items: [VISIT], total: 1, skip: 0, limit: 25 });
    (programsApi.listPrograms as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        {
          ...VISIT.program,
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: null,
          active: true,
          sortOrder: 0,
          createdAt: STAMP,
          updatedAt: STAMP,
        },
      ],
      total: 1,
    });
    (adminApi.fetchSites as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, title: 'Quetzaltenango', sortOrder: 0, createdAt: STAMP, updatedAt: STAMP },
      { id: 9, title: 'Another site', sortOrder: 1, createdAt: STAMP, updatedAt: STAMP },
    ]);
    (adminApi.fetchCommunities as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 2, title: 'Xela', siteId: 1, sortOrder: 0, createdAt: STAMP, updatedAt: STAMP },
    ]);
  });

  it('renders a row per visit with subject, program, location and recorder', async () => {
    renderPage();

    await waitFor(() => expect(screen.getAllByText('4/9/2026').length).toBeGreaterThan(0));

    expect(screen.getAllByText('Jose Lopez').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nutrition').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Home · Xela').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ana Perez').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Moderate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6.5 kg').length).toBeGreaterThan(0);
  });

  it('links a row to the visit detail and the subject to the enrollment', async () => {
    renderPage();

    const dateLinks = await screen.findAllByRole('link', { name: '4/9/2026' });
    expect(dateLinks[0]).toHaveAttribute('href', '/visits/77');

    const subjectLinks = screen.getAllByRole('link', { name: 'Jose Lopez' });
    expect(subjectLinks[0]).toHaveAttribute('href', '/enrollments/12');
  });

  it('sends the program filter to the API', async () => {
    renderPage();

    await waitFor(() => expect(mockList).toHaveBeenCalled());

    fireEvent.change(await screen.findByLabelText('Program'), { target: { value: '3' } });

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ programId: 3 }))
    );
  });

  it('shows the empty state when nothing matches', async () => {
    mockList.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 25 });
    renderPage();

    expect(await screen.findByText('No visits recorded yet.')).toBeInTheDocument();
  });

  it('shows an error banner when the list fails', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('Could not load visits.')).toBeInTheDocument();
  });

  it('searches across pages and resets pagination before requesting matching visits', async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue({ items: [VISIT], total: 30, skip: 0, limit: 25 });
    renderPage();
    await screen.findByRole('button', { name: 'Next' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 25 })));
    // The initial empty search must not reset a page chosen shortly after loading.
    await new Promise(resolve => setTimeout(resolve, 350));
    expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 25 }));
    await user.type(screen.getByRole('searchbox', { name: 'Find a person or family' }), ' Jose ');
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Jose', skip: 0 })));
    await user.click(screen.getByRole('button', { name: 'Clear visit search' }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, skip: 0 })));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('sends date, site and community filters and clears an incompatible community', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Xela' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText('Community'), { target: { value: '2' } });
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({
      from: '2026-09-01', to: '2026-09-30', communityId: 2,
    })));
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: '9' } });
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({
      siteId: 9, communityId: undefined, skip: 0,
    })));
    expect(screen.getByLabelText('Community')).toHaveValue('');
    expect(screen.queryByRole('option', { name: 'Xela' })).not.toBeInTheDocument();
  });

  it('keeps a selected community when returning to all sites', async () => {
    renderPage();
    await screen.findByRole('option', { name: 'Xela' });
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Community'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: '' } });
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({
      siteId: undefined, communityId: 2,
    })));
  });

  it('shows a useful empty message when filters have no matches', async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 25 });
    renderPage();
    await user.type(screen.getByRole('searchbox'), 'nobody');
    expect(await screen.findByText('No visits match your search or filters.')).toBeInTheDocument();
  });

  it('uses the missing-recorder label without losing pregnancy measurements', async () => {
    mockList.mockResolvedValue({
      items: [{ ...VISIT, recordedByName: null, nutritionDetail: null, pregnancyDetail: { weight: 65 } }],
      total: 1, skip: 0, limit: 25,
    });
    renderPage();
    expect((await screen.findAllByText('Not recorded')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('65 kg').length).toBeGreaterThan(0);
    expect(screen.queryByText('Moderate')).not.toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Open visit for Jose Lopez on 4/9/2026' });
    expect(links[0]).toHaveAttribute('href', '/visits/77');
  });

  it('translates the new headings and filter controls', async () => {
    mockAuth.mockReturnValue({ user: { id: 1, role: 'CASEWORKER' }, lang: 'es' });
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Todas las visitas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Filtrar visitas' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Buscar una persona o familia' })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Xela' });
  });

});
