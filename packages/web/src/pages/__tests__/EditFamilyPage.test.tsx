import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditFamilyPage } from '../families/EditFamilyPage';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import type { FamilyRead } from '@naru/shared';

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

const family: FamilyRead = {
  id: 11,
  localId: null,
  familyName: 'Ramirez Family',
  communityId: 3,
  phone: '5512-3344',
  caretaker2Name: 'Ana Ramirez',
  incomeSources: 'Weaving',
  deathsNotes: null,
  inCrisis: false,
  notes: 'Doing well',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/families/11/edit']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/families/:id/edit" element={<EditFamilyPage />} />
          <Route path="/families/:id" element={<div>family detail</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('EditFamilyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(familiesApi.fetchFamily).mockResolvedValue(family);
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

  it('prefills the form from the loaded family', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('Ramirez Family')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5512-3344')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ana Ramirez')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Weaving')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Doing well')).toBeInTheDocument();
  });

  it('updates rather than creates, then returns to the family', async () => {
    const user = userEvent.setup();
    vi.mocked(familiesApi.updateFamily).mockResolvedValue({
      ...family,
      familyName: 'Ramirez',
    });

    renderPage();

    const nameInput = await screen.findByDisplayValue('Ramirez Family');
    await user.clear(nameInput);
    await user.type(nameInput, 'Ramirez');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(familiesApi.updateFamily).toHaveBeenCalledWith(
        11,
        expect.objectContaining({ familyName: 'Ramirez', communityId: 3, inCrisis: false })
      );
    });
    expect(familiesApi.createFamily).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('family detail')).toBeInTheDocument();
    });
  });

  it('shows an error when the family cannot be loaded', async () => {
    vi.mocked(familiesApi.fetchFamily).mockRejectedValue(new Error('boom'));

    const { container } = renderPage();

    await waitFor(() => {
      expect(container.querySelector('.text-hv-crisis')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });
});
