import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditMotherPage } from '../mothers/EditMotherPage';
import { mothersApi } from '../../api/mothers';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';
import type { MotherRead } from '@naru/shared';

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

const mother: MotherRead = {
  id: 7,
  localId: null,
  name: 'Maria Lopez',
  birthDate: '1996-04-02T00:00:00.000Z',
  communityId: 3,
  phone: '5512-3344',
  familyId: null,
  midwifeId: null,
  pregnancies: 3,
  childrenCount: 2,
  breastfedCount: 2,
  malnutritionDeaths: 0,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/mothers/7/edit']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/mothers/:id/edit" element={<EditMotherPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('EditMotherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mothersApi.fetchMother).mockResolvedValue(mother);
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

  it('prefills the form from the loaded mother', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('Maria Lopez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1996-04-02')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5512-3344')).toBeInTheDocument();
  });

  it('saves the edited name', async () => {
    const user = userEvent.setup();
    vi.mocked(mothersApi.updateMother).mockResolvedValue({ ...mother, name: 'Maria L' });

    renderPage();

    const nameInput = await screen.findByDisplayValue('Maria Lopez');
    await user.clear(nameInput);
    await user.type(nameInput, 'Maria L');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(mothersApi.updateMother).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ name: 'Maria L', communityId: 3 })
      );
    });
  });
});
