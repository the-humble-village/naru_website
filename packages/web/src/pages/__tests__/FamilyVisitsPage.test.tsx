import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FamilyVisitsPage } from '../visits/FamilyVisitsPage';
import { visitsApi } from '../../api/visits';
import { familiesApi } from '../../api/families';

vi.mock('../../api/visits', () => ({
  visitsApi: {
    listFamilyVisits: vi.fn(),
  },
}));

vi.mock('../../api/families', () => ({
  familiesApi: {
    fetchFamily: vi.fn(),
  },
}));

const makeVisit = (id: number, visitDate: string) => ({
  id,
  familyId: 1,
  localId: null,
  visitDate,
  trainingsReceived: [],
  resourcesReceived: [],
  questions: [],
  photos: [],
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/families/1/visits']}>
        <Routes>
          <Route path="/families/:id/visits" element={<FamilyVisitsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('FamilyVisitsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (familiesApi.fetchFamily as any).mockResolvedValue({ id: 1, familyName: 'Ramirez' });
    (visitsApi.listFamilyVisits as any).mockResolvedValue({
      visits: [makeVisit(10, '2026-03-01T10:00:00.000Z'), makeVisit(11, '2026-04-01T10:00:00.000Z')],
      total: 2,
      skip: 0,
      limit: 20,
    });
  });

  it('renders the visits returned by the API', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('2 visits')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('link', { name: /2026/ })).toHaveLength(2);
  });

  it('links back to the family and to the add-visit form', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Back to Ramirez/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Back to Ramirez/ })).toHaveAttribute('href', '/families/1');
    expect(screen.getByRole('link', { name: 'Add Visit' })).toHaveAttribute('href', '/families/1/visits/new');
  });

  it('shows an empty state when the family has no visits', async () => {
    (visitsApi.listFamilyVisits as any).mockResolvedValue({ visits: [], total: 0, skip: 0, limit: 20 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No visits recorded yet')).toBeInTheDocument();
    });
  });

  it('hides pagination when everything fits on one page', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('2 visits')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument();
  });

  it('pages through the list, requesting the right skip', async () => {
    (visitsApi.listFamilyVisits as any).mockResolvedValue({
      visits: [makeVisit(10, '2026-03-01T10:00:00.000Z')],
      total: 25,
      skip: 0,
      limit: 20,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('25 visits')).toBeInTheDocument());
    expect(visitsApi.listFamilyVisits).toHaveBeenCalledWith(1, { skip: 0, limit: 20 });
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    await waitFor(() => {
      expect(visitsApi.listFamilyVisits).toHaveBeenCalledWith(1, { skip: 20, limit: 20 });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
    });
  });

  it('surfaces a load failure instead of an empty list', async () => {
    (visitsApi.listFamilyVisits as any).mockRejectedValue(new Error('boom'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Could not load visits.')).toBeInTheDocument();
    });
  });
});
