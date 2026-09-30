import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChildrenPage } from '../children/ChildrenPage';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import type { ChildRead } from '@naru/shared';

vi.mock('../../api/children', () => ({
  childrenApi: {
    listChildren: vi.fn(),
    fetchChild: vi.fn(),
    createChild: vi.fn(),
    updateChild: vi.fn(),
    deleteChild: vi.fn(),
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

const child: ChildRead = {
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
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/children']}>
      <QueryClientProvider client={queryClient}>
        <ChildrenPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('ChildrenPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(childrenApi.listChildren).mockResolvedValue({
      items: [child],
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

  it('lists children and flags the ones with no mother linked', async () => {
    renderPage();

    const links = await screen.findAllByRole('link', { name: 'Jose Ramirez' });
    expect(links[0]).toHaveAttribute('href', '/children/5');
    expect(screen.getAllByText('children.no_mother').length).toBeGreaterThan(0);
  });

  it('sends the site filter to the server rather than filtering the page', async () => {
    const { container } = renderPage();

    await screen.findAllByRole('link', { name: 'Jose Ramirez' });

    const siteSelect = container.querySelector('#filter-site') as HTMLSelectElement;
    fireEvent.change(siteSelect, { target: { value: '9' } });

    await waitFor(() => {
      expect(childrenApi.listChildren).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: 9, skip: 0 })
      );
    });
  });

  it('shows an empty state when nothing matches', async () => {
    vi.mocked(childrenApi.listChildren).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 25,
    });

    renderPage();

    expect(await screen.findByText('children.empty')).toBeInTheDocument();
  });
});
