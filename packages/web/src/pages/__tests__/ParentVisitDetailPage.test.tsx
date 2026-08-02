import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ParentVisitDetailPage from '../visits/ParentVisitDetailPage';
import { visitsApi } from '../../api/visits';
import { ParentVisitRead } from '@naru/shared';

vi.mock('../../api/visits', () => ({
  visitsApi: {
    fetchParentVisit: vi.fn(),
    deleteParentVisit: vi.fn(),
  },
}));

const auth = vi.hoisted(() => ({
  user: {
    id: 1,
    login: 'supervisor',
    email: 'sup@test.com',
    firstName: 'Sam',
    lastName: 'Supervisor',
    role: 'SUPERVISOR' as 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER',
    lang: 'en',
  },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: auth.user }),
}));

const mockVisit: ParentVisitRead = {
  id: 7,
  localId: null,
  familyId: 42,
  parentId: 3,
  visitDate: '2024-01-15T10:00:00.000Z',
  weight: 62.5,
  trainingsReceived: [{ id: 1, title: 'Nutrition basics' }],
  resourcesReceived: [{ id: 2, title: 'Vitamin pack' }],
  questions: [{ questionId: 5, question: 'Feeling well?', answer: 'Yes' }],
  photos: [],
  notes: 'All good',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderPage = () =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/families/42/parents/3/visits/7']}>
        <Routes>
          <Route path="/families/:id/parents/:pid/visits/:vid" element={<ParentVisitDetailPage />} />
          <Route path="/families/:id/parents/:pid" element={<div>Parent Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('ParentVisitDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user.role = 'SUPERVISOR';
    vi.mocked(visitsApi.fetchParentVisit).mockResolvedValue(mockVisit);
  });

  describe('Rendering', () => {
    it('should render the visit details', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Parent Visit/)).toBeInTheDocument();
      });

      expect(screen.getByText('62.5 kg')).toBeInTheDocument();
      expect(screen.getByText('Nutrition basics')).toBeInTheDocument();
      expect(screen.getByText('Vitamin pack')).toBeInTheDocument();
      expect(screen.getByText('Feeling well?')).toBeInTheDocument();
      expect(screen.getByText('All good')).toBeInTheDocument();
    });

    it('should show error state when the visit cannot be loaded', async () => {
      vi.mocked(visitsApi.fetchParentVisit).mockRejectedValue(new Error('Not found'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to load visit details.')).toBeInTheDocument();
      });
    });

    it('should keep the edit link pointing at the edit route', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Edit').closest('a')).toHaveAttribute(
          'href',
          '/families/42/parents/3/visits/7/edit'
        );
      });
    });
  });

  describe('Delete Functionality', () => {
    const openDialog = async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      return screen.getByRole('dialog');
    };

    it('should show a Delete button for a supervisor', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      });
    });

    it('should hide the Delete button from a caseworker', async () => {
      auth.user.role = 'CASEWORKER';

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Parent Visit/)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('should open the confirm dialog instead of deleting immediately', async () => {
      const dialog = await openDialog();

      expect(within(dialog).getByText('Delete parent visit')).toBeInTheDocument();
      expect(visitsApi.deleteParentVisit).not.toHaveBeenCalled();
    });

    it('should warn that nested visit data is removed too', async () => {
      const dialog = await openDialog();

      expect(within(dialog).getByText(/question answers and photos/)).toBeInTheDocument();
    });

    it('should not use window.confirm', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      await openDialog();

      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('should close the dialog without deleting when Cancel is clicked', async () => {
      const dialog = await openDialog();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(visitsApi.deleteParentVisit).not.toHaveBeenCalled();
    });

    it('should delete the visit and navigate back to the parent page on confirm', async () => {
      vi.mocked(visitsApi.deleteParentVisit).mockResolvedValue(undefined);

      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(visitsApi.deleteParentVisit).toHaveBeenCalledWith(42, 3, 7);
      });

      await waitFor(() => {
        expect(screen.getByText('Parent Detail Page')).toBeInTheDocument();
      });
    });

    it('should show an error message when the delete fails', async () => {
      vi.mocked(visitsApi.deleteParentVisit).mockRejectedValue(new Error('Delete failed'));

      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByText(/Error deleting visit: Delete failed/)).toBeInTheDocument();
      });
    });
  });
});
