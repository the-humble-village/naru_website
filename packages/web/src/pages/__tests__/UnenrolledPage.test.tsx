import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UnenrolledPage } from '../UnenrolledPage';
import { mothersApi } from '../../api/mothers';
import { childrenApi } from '../../api/children';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { programsApi } from '../../api/programs';
import { dashboardApi } from '../../api/dashboard';
import { adminApi } from '../../api/admin';

vi.mock('../../api/mothers', () => ({
  mothersApi: {
    listMothers: vi.fn(),
    fetchMother: vi.fn(),
    createMother: vi.fn(),
    updateMother: vi.fn(),
    deleteMother: vi.fn(),
  },
}));
vi.mock('../../api/children', () => ({
  childrenApi: {
    listChildren: vi.fn(),
    fetchChild: vi.fn(),
    createChild: vi.fn(),
    updateChild: vi.fn(),
    deleteChild: vi.fn(),
  },
}));
vi.mock('../../api/people', () => ({
  peopleApi: {
    listPeople: vi.fn(),
    fetchPerson: vi.fn(),
    fetchAssignedMothers: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    deletePerson: vi.fn(),
  },
}));
vi.mock('../../api/families', () => ({
  familiesApi: {
    listFamilies: vi.fn(),
    fetchFamily: vi.fn(),
    createFamily: vi.fn(),
    updateFamily: vi.fn(),
    deleteFamily: vi.fn(),
  },
}));
vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),
  },
}));
vi.mock('../../api/dashboard', () => ({
  dashboardApi: { fetchDashboardData: vi.fn(), fetchUnenrolledCount: vi.fn() },
}));
vi.mock('../../api/admin', () => ({
  adminApi: { fetchCommunities: vi.fn(), fetchSites: vi.fn() },
}));
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ lang: 'en', user: { id: 1, role: 'CASEWORKER' } }),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/unenrolled']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/unenrolled" element={<UnenrolledPage />} />
          <Route path="/programs/:id/enroll" element={<div>enroll wizard</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('UnenrolledPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardApi.fetchUnenrolledCount).mockResolvedValue({
      children: 1,
      mothers: 1,
      people: 0,
      families: 1,
      total: 3,
    });
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue([
      {
        id: 3,
        title: 'Xela',
        siteId: 9,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(adminApi.fetchSites).mockResolvedValue([
      {
        id: 9,
        title: 'Quetzaltenango',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(programsApi.listPrograms).mockResolvedValue({
      items: [
        {
          id: 2,
          name: 'Nutrition Infant',
          kind: 'NUTRITION',
          subjectType: 'CHILD',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: 30,
          active: true,
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 4,
          name: 'Family PAF',
          kind: 'FAMILY_PAF',
          subjectType: 'FAMILY',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: null,
          active: true,
          sortOrder: 2,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 2,
    });
    vi.mocked(familiesApi.listFamilies).mockResolvedValue({
      families: [
        {
          id: 11,
          localId: null,
          familyName: 'Ramirez Family',
          communityId: 3,
          siteId: 9,
          phone: null,
          caretaker2Name: null,
          incomeSources: null,
          deathsNotes: null,
          inCrisis: false,
          notes: null,
          lastVisitDate: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      skip: 0,
      limit: 25,
    });
    vi.mocked(mothersApi.listMothers).mockResolvedValue({
      items: [
        {
          id: 7,
          localId: null,
          name: 'Maria Lopez',
          birthDate: null,
          communityId: 3,
          phone: null,
          familyId: null,
          midwifeId: null,
          pregnancies: null,
          childrenCount: null,
          breastfedCount: null,
          malnutritionDeaths: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      skip: 0,
      limit: 25,
    });
    vi.mocked(childrenApi.listChildren).mockResolvedValue({
      items: [
        {
          id: 5,
          localId: null,
          name: 'Jose Ramirez',
          birthDate: '2026-05-01T00:00:00.000Z',
          sex: 'MALE',
          communityId: 3,
          motherId: null,
          familyId: null,
          notes: null,
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      total: 1,
      skip: 0,
      limit: 25,
    });
    vi.mocked(peopleApi.listPeople).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 25,
    });
  });

  it('mixes mothers and children into one worklist with subject badges', async () => {
    renderPage();

    expect((await screen.findAllByRole('link', { name: 'Maria Lopez' }))[0]).toHaveAttribute(
      'href',
      '/mothers/7'
    );
    expect(screen.getAllByRole('link', { name: 'Jose Ramirez' })[0]).toHaveAttribute(
      'href',
      '/children/5'
    );
    expect(screen.getAllByText('Mother').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Child').length).toBeGreaterThan(0);
  });

  it('only offers programs whose subject type matches the row', async () => {
    renderPage();

    await screen.findAllByRole('link', { name: 'Jose Ramirez' });

    const childSelects = screen.getAllByLabelText('Enroll in...: Jose Ramirez');
    expect(childSelects[0]).toHaveTextContent('Nutrition Infant');
    expect(screen.getAllByText('No program available').length).toBeGreaterThan(0);
  });

  it('lists unenrolled families alongside the other subjects', async () => {
    renderPage();

    expect((await screen.findAllByRole('link', { name: 'Ramirez Family' }))[0]).toHaveAttribute(
      'href',
      '/families/11'
    );
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
    expect(familiesApi.listFamilies).toHaveBeenCalledWith(
      expect.objectContaining({ unenrolled: true })
    );
  });

  it('offers only FAMILY-subject programs on a family row', async () => {
    renderPage();

    await screen.findAllByRole('link', { name: 'Ramirez Family' });

    const [select] = screen.getAllByLabelText('Enroll in...: Ramirez Family');
    expect(select).toHaveTextContent('Family PAF');
    expect(select).not.toHaveTextContent('Nutrition Infant');
  });

  it('navigates to the enroll wizard carrying the subject FK', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByRole('link', { name: 'Jose Ramirez' });
    const [select] = screen.getAllByLabelText('Enroll in...: Jose Ramirez');
    await user.selectOptions(select as HTMLElement, '2');

    await waitFor(() => {
      expect(screen.getByText('enroll wizard')).toBeInTheDocument();
    });
  });

  it('filters the complete worklist on the server and keeps the type tab when clearing', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('link', { name: 'Maria Lopez' });
    await user.click(screen.getByRole('tab', { name: /^Mothers/ }));
    await user.type(screen.getByRole('searchbox'), 'Maria');
    await user.selectOptions(screen.getByLabelText('Site'), '9');
    await user.selectOptions(screen.getByLabelText('Community'), '3');
    await waitFor(() => expect(mothersApi.listMothers).toHaveBeenLastCalledWith(expect.objectContaining({ unenrolled: true, search: 'Maria', siteId: 9, communityId: 3, skip: 0 })));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(mothersApi.listMothers).toHaveBeenLastCalledWith(expect.objectContaining({ unenrolled: true, search: undefined, siteId: undefined, communityId: undefined, skip: 0 })));
    expect(screen.getByRole('tab', { name: /^Mothers/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a failed request rather than an empty worklist', async () => {
    vi.mocked(childrenApi.listChildren).mockRejectedValue(new Error('Request failed'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load unenrolled records.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

});
