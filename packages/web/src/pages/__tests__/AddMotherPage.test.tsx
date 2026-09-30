import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddMotherPage } from '../mothers/AddMotherPage';
import { mothersApi } from '../../api/mothers';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { programsApi } from '../../api/programs';
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
    <MemoryRouter initialEntries={['/mothers/new']}>
      <QueryClientProvider client={queryClient}>
        <AddMotherPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('AddMotherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(familiesApi.listFamilies).mockResolvedValue({
      families: [],
      total: 0,
      skip: 0,
      limit: 100,
    });
    vi.mocked(programsApi.listPrograms).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(peopleApi.listPeople).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 100,
    });
  });

  it('renders the form with name as the only required field', async () => {
    renderPage();

    expect(await screen.findByLabelText(/form\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText('form.birth_date')).not.toBeRequired();
    expect(screen.getByLabelText('form.community')).not.toBeRequired();
  });

  it('creates a mother with only a name', async () => {
    const user = userEvent.setup();
    vi.mocked(mothersApi.createMother).mockResolvedValue({
      id: 4,
      localId: null,
      name: 'Ana Perez',
      birthDate: null,
      communityId: null,
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
    });

    renderPage();

    await user.type(await screen.findByLabelText(/form\.name/), 'Ana Perez');
    await user.click(screen.getByRole('button', { name: 'mothers.add' }));

    await waitFor(() => {
      expect(mothersApi.createMother).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ana Perez', communityId: null, midwifeId: null })
      );
    });
  });

  it('blocks a submit with no name', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText(/form\.name/);
    await user.click(screen.getByRole('button', { name: 'mothers.add' }));

    await waitFor(() => {
      expect(mothersApi.createMother).not.toHaveBeenCalled();
    });
  });
});
