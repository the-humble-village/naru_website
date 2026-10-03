import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddPersonPage } from '../people/AddPersonPage';
import { peopleApi } from '../../api/people';
import { adminApi } from '../../api/admin';

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

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/people/new']}>
      <QueryClientProvider client={queryClient}>
        <AddPersonPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('AddPersonPage', () => {
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
  });

  it('renders the form', async () => {
    renderPage();

    expect(await screen.findByLabelText(/form\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText('form.sex')).toBeInTheDocument();
  });

  it('creates a person with only a name', async () => {
    const user = userEvent.setup();
    vi.mocked(peopleApi.createPerson).mockResolvedValue({
      id: 21,
      localId: null,
      name: 'Carmen Say',
      birthDate: null,
      sex: null,
      communityId: null,
      phone: null,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderPage();

    await user.type(await screen.findByLabelText(/form\.name/), 'Carmen Say');
    await user.click(screen.getByRole('button', { name: 'people.add' }));

    await waitFor(() => {
      expect(peopleApi.createPerson).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Carmen Say', sex: null, communityId: null })
      );
    });
  });
});
