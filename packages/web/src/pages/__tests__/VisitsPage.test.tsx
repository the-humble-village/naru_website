import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import VisitsPage from '../visits/VisitsPage';
import { visitsApi } from '../../api/visits';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'CASEWORKER' }, lang: 'en' }),
}));

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
    expect(screen.getAllByText('visit.location_home · Xela').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ana Perez').length).toBeGreaterThan(0);
    expect(screen.getAllByText('nutrition.moderate').length).toBeGreaterThan(0);
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

    fireEvent.change(await screen.findByLabelText('filter.program'), { target: { value: '3' } });

    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ programId: 3 }))
    );
  });

  it('shows the empty state when nothing matches', async () => {
    mockList.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 25 });
    renderPage();

    expect(await screen.findByText('visit.empty')).toBeInTheDocument();
  });

  it('shows an error banner when the list fails', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('visit.load_failed')).toBeInTheDocument();
  });
});
