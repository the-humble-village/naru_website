import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditPersonPage } from '../people/EditPersonPage';
import { peopleApi } from '../../api/people';
import { adminApi } from '../../api/admin';
import type { PersonRead } from '@naru/shared';

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
vi.mock('../../api/admin', () => ({
  adminApi: { fetchCommunities: vi.fn(), fetchSites: vi.fn() },
}));
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ lang: 'en', user: { id: 1, role: 'CASEWORKER' } }),
}));

const person: PersonRead = {
  id: 12,
  localId: null,
  name: 'Juana Ramirez',
  birthDate: '1988-06-10T00:00:00.000Z',
  sex: 'FEMALE',
  communityId: 3,
  phone: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/people/12/edit']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/people/:id/edit" element={<EditPersonPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('EditPersonPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(peopleApi.fetchPerson).mockResolvedValue(person);
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
  });

  it('prefills the form from the loaded person', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('Juana Ramirez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1988-06-10')).toBeInTheDocument();
  });

  it('saves the edited person', async () => {
    const user = userEvent.setup();
    vi.mocked(peopleApi.updatePerson).mockResolvedValue({ ...person, name: 'Juana R' });

    renderPage();

    const nameInput = await screen.findByDisplayValue('Juana Ramirez');
    await user.clear(nameInput);
    await user.type(nameInput, 'Juana R');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(peopleApi.updatePerson).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ name: 'Juana R', sex: 'FEMALE', communityId: 3 })
      );
    });
  });
});
