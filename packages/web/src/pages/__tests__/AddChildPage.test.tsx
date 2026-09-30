import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AddChildPage } from '../children/AddChildPage';
import { childrenApi } from '../../api/children';
import { mothersApi } from '../../api/mothers';
import { familiesApi } from '../../api/families';
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
vi.mock('../../api/mothers', () => ({
  mothersApi: {
    listMothers: vi.fn(),
    fetchMother: vi.fn(),
    createMother: vi.fn(),
    updateMother: vi.fn(),
    deleteMother: vi.fn(),
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
vi.mock('../../api/admin', () => ({
  adminApi: { fetchCommunities: vi.fn(), fetchSites: vi.fn() },
}));
vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ lang: 'en', user: { id: 1, role: 'CASEWORKER' } }),
}));

const created: ChildRead = {
  id: 5,
  localId: null,
  name: 'Jose Ramirez',
  birthDate: '2026-05-01T00:00:00.000Z',
  sex: 'MALE',
  communityId: null,
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
    <MemoryRouter initialEntries={['/children/new']}>
      <QueryClientProvider client={queryClient}>
        <AddChildPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('AddChildPage', () => {
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
    vi.mocked(mothersApi.listMothers).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 100,
    });
    vi.mocked(familiesApi.listFamilies).mockResolvedValue({
      families: [],
      total: 0,
      skip: 0,
      limit: 100,
    });
  });

  it('offers community, mother and family as optional fields', async () => {
    renderPage();

    expect(await screen.findByLabelText(/form\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText('form.community')).toBeInTheDocument();
    expect(screen.getByLabelText('form.family')).toBeInTheDocument();
    expect(screen.getByLabelText('form.mother')).toBeInTheDocument();
  });

  it('admits a child with no mother and no family', async () => {
    const user = userEvent.setup();
    vi.mocked(childrenApi.createChild).mockResolvedValue(created);

    renderPage();

    await user.type(await screen.findByLabelText(/form\.name/), 'Jose Ramirez');
    await user.type(screen.getByLabelText(/form\.birth_date/), '2026-05-01');
    await user.click(screen.getByRole('button', { name: 'Add Child' }));

    await waitFor(() => {
      expect(childrenApi.createChild).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jose Ramirez',
          sex: 'MALE',
          motherId: null,
          familyId: null,
        })
      );
    });
  });
});
