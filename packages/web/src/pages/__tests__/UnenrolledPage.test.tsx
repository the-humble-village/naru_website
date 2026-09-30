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
      families: 0,
      total: 2,
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
      ],
      total: 1,
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
    expect(screen.getAllByText('subject_type.mother').length).toBeGreaterThan(0);
    expect(screen.getAllByText('subject_type.child').length).toBeGreaterThan(0);
  });

  it('only offers programs whose subject type matches the row', async () => {
    renderPage();

    await screen.findAllByRole('link', { name: 'Jose Ramirez' });

    const childSelects = screen.getAllByLabelText('unenrolled.enroll: Jose Ramirez');
    expect(childSelects[0]).toHaveTextContent('Nutrition Infant');
    expect(screen.getAllByText('unenrolled.no_program').length).toBeGreaterThan(0);
  });

  it('navigates to the enroll wizard carrying the subject FK', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByRole('link', { name: 'Jose Ramirez' });
    const [select] = screen.getAllByLabelText('unenrolled.enroll: Jose Ramirez');
    await user.selectOptions(select as HTMLElement, '2');

    await waitFor(() => {
      expect(screen.getByText('enroll wizard')).toBeInTheDocument();
    });
  });
});
