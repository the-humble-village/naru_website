import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PeoplePage } from '../people/PeoplePage';
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
  adminApi: {
    fetchCommunities: vi.fn(),
    fetchSites: vi.fn(),
  },
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
    <MemoryRouter initialEntries={['/people']}>
      <QueryClientProvider client={queryClient}>
        <PeoplePage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('PeoplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(peopleApi.listPeople).mockResolvedValue({
      items: [person],
      total: 1,
      skip: 0,
      limit: 25,
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
  });

  it('lists people linking to their profile', async () => {
    renderPage();

    const links = await screen.findAllByRole('link', { name: 'Juana Ramirez' });
    expect(links[0]).toHaveAttribute('href', '/people/12');
  });

  it('sends the site filter to the server rather than filtering the page', async () => {
    const { container } = renderPage();

    await screen.findAllByRole('link', { name: 'Juana Ramirez' });

    const siteSelect = container.querySelector('#filter-site') as HTMLSelectElement;
    fireEvent.change(siteSelect, { target: { value: '9' } });

    await waitFor(() => {
      expect(peopleApi.listPeople).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: 9, skip: 0 })
      );
    });
  });

  it('shows an empty state when nothing matches', async () => {
    vi.mocked(peopleApi.listPeople).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 25,
    });

    renderPage();

    expect(await screen.findByText('No people found.')).toBeInTheDocument();
  });
});
