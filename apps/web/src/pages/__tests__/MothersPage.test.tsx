import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MothersPage } from '../mothers/MothersPage';
import { mothersApi } from '../../api/mothers';
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

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchCommunities: vi.fn(),
    fetchSites: vi.fn(),
  },
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
    <MemoryRouter initialEntries={['/mothers']}>
      <QueryClientProvider client={queryClient}>
        <MothersPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('MothersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mothersApi.listMothers).mockResolvedValue({
      items: [mother],
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

  it('lists mothers with the site derived from their community', async () => {
    renderPage();

    const links = await screen.findAllByRole('link', { name: 'Maria Lopez' });
    expect(links[0]).toHaveAttribute('href', '/mothers/7');
    expect(screen.getAllByText('Xela').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quetzaltenango').length).toBeGreaterThan(0);
  });

  it('sends the site filter to the server rather than filtering the page', async () => {
    const { container } = renderPage();

    await screen.findAllByRole('link', { name: 'Maria Lopez' });

    const siteSelect = container.querySelector('#filter-site') as HTMLSelectElement;
    fireEvent.change(siteSelect, { target: { value: '9' } });

    await waitFor(() => {
      expect(mothersApi.listMothers).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: 9, skip: 0 })
      );
    });
  });

  it('shows an empty state when nothing matches', async () => {
    vi.mocked(mothersApi.listMothers).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 25,
    });

    renderPage();

    expect(await screen.findByText('No mothers found.')).toBeInTheDocument();
  });

  it('clears search and location filters and returns to the first page', async () => {
    vi.mocked(mothersApi.listMothers).mockResolvedValue({ items: [mother], total: 60, skip: 0, limit: 25 });
    renderPage();
    await screen.findAllByRole('link', { name: 'Maria Lopez' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('Site'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Community'), { target: { value: '3' } });
    await waitFor(() => expect(mothersApi.listMothers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Maria', siteId: 9, communityId: 3, skip: 0 })));
    await screen.findAllByRole('link', { name: 'Maria Lopez' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(mothersApi.listMothers).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 25 })));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(mothersApi.listMothers).toHaveBeenLastCalledWith({ search: undefined, siteId: undefined, communityId: undefined, skip: 0, limit: 25 }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByLabelText('Site')).toHaveValue('');
    expect(screen.getByLabelText('Community')).toHaveValue('');
  });

});
