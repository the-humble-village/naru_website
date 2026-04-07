import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { FamilyVisitDetailPage } from '../visits/FamilyVisitDetailPage';
import * as visitsModule from '../../api/visits';

vi.mock('../../api/visits', () => ({
  visitsApi: {
    fetchFamilyVisit: vi.fn(),
  },
}));

const mockVisit = {
  id: 7,
  localId: null,
  familyId: 42,
  visitDate: '2024-01-15T10:00:00Z',
  trainingsReceived: [],
  resourcesReceived: [],
  questions: [],
  notes: null,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const makeQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithRouter = (familyId = '42', visitId = '7') => {
  vi.mocked(visitsModule.visitsApi.fetchFamilyVisit).mockResolvedValue(mockVisit);
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/families/${familyId}/visits/${visitId}`]}>
        <Routes>
          <Route path="/families/:id/visits/:vid" element={<FamilyVisitDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('FamilyVisitDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page heading with visit date', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText(/Family Visit/)).toBeInTheDocument();
    });
  });

  it('should render a back link to the family detail page', async () => {
    renderWithRouter('42', '7');
    await waitFor(() => {
      const backLink = screen.getByText(/Back to Family/);
      expect(backLink.closest('a')).toHaveAttribute('href', '/families/42');
    });
  });

  it('should show error state when visit cannot be loaded', async () => {
    vi.mocked(visitsModule.visitsApi.fetchFamilyVisit).mockRejectedValue(new Error('Not found'));
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter initialEntries={['/families/42/visits/7']}>
          <Routes>
            <Route path="/families/:id/visits/:vid" element={<FamilyVisitDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText('Failed to load visit details.')).toBeInTheDocument();
    });
  });

  it('should display visit date and recorded date sections', async () => {
    renderWithRouter('42', '7');
    await waitFor(() => {
      expect(screen.getByText('Visit Date')).toBeInTheDocument();
      expect(screen.getByText('Recorded')).toBeInTheDocument();
    });
  });
});
