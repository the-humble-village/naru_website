import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FamilyVisitDetailPage } from '../visits/FamilyVisitDetailPage';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';

vi.mock('../../api/visits', () => ({
  visitsApi: {
    fetchFamilyVisit: vi.fn(),
    updateFamilyVisit: vi.fn(),
    deleteFamilyVisit: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchTraining: vi.fn(),
    fetchResources: vi.fn(),
    fetchFamilyVisitQuestions: vi.fn(),
  },
}));

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../../api/files', () => ({
  filesApi: {
    getPresignedDownloadUrls: vi.fn(),
    presignUpload: vi.fn(),
    confirmUpload: vi.fn(),
    uploadFileToS3: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

// Deleting a visit is supervisor-gated in the UI, matching the backend route.
const mockAuthUser: {
  id: number;
  login: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER';
  lang: string;
} = {
  id: 1,
  login: 'supervisor',
  email: null,
  firstName: null,
  lastName: null,
  role: 'SUPERVISOR',
  lang: 'en',
};

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockAuthUser }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockVisit = {
  id: 7,
  localId: null,
  familyId: 42,
  visitDate: '2024-01-15T10:00:00Z',
  trainingsReceived: [{ id: 1, title: 'Nutrition' }],
  resourcesReceived: [{ id: 11, title: 'Soap' }],
  questions: [{ questionId: 5, question: 'How is the family?', answer: 'Doing well' }],
  photos: [],
  notes: 'Original notes',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
};

const mockTrainings = [
  { id: 1, title: 'Nutrition', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Hygiene', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockResources = [
  { id: 11, title: 'Soap', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 12, title: 'Blanket', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockQuestions = [
  { id: 5, title: 'How is the family?', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 6, title: 'Any concerns?', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const renderPage = (familyId = '42', visitId = '7') =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[`/families/${familyId}/visits/${visitId}`]}>
        <Routes>
          <Route path="/families/:id/visits/:vid" element={<FamilyVisitDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

/** Renders, waits for the visit to load, then enters inline edit mode. */
const renderAndEdit = async () => {
  renderPage();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
  await waitFor(() => {
    expect(screen.getByLabelText('Visit Date')).toBeInTheDocument();
  });
};

describe('FamilyVisitDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = 'SUPERVISOR';
    vi.mocked(visitsApi.fetchFamilyVisit).mockResolvedValue(mockVisit);
    vi.mocked(visitsApi.updateFamilyVisit).mockResolvedValue(mockVisit);
    vi.mocked(visitsApi.deleteFamilyVisit).mockResolvedValue(undefined);
    vi.mocked(adminApi.fetchTraining).mockResolvedValue(mockTrainings);
    vi.mocked(adminApi.fetchResources).mockResolvedValue(mockResources);
    vi.mocked(adminApi.fetchFamilyVisitQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(questionSetsApi.list).mockResolvedValue([]);
  });

  describe('Read view', () => {
    it('should render the page heading with visit date', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Family Visit/)).toBeInTheDocument();
      });
    });

    it('should render a back link to the family detail page', async () => {
      renderPage();
      await waitFor(() => {
        const backLink = screen.getByText(/Back to Family/);
        expect(backLink.closest('a')).toHaveAttribute('href', '/families/42');
      });
    });

    it('should show error state when visit cannot be loaded', async () => {
      vi.mocked(visitsApi.fetchFamilyVisit).mockRejectedValue(new Error('Not found'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Failed to load visit details.')).toBeInTheDocument();
      });
    });

    it('should display visit date and recorded date sections', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Visit Date')).toBeInTheDocument();
        expect(screen.getByText('Recorded')).toBeInTheDocument();
      });
    });

    it('should display trainings, resources, question answers and notes', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nutrition')).toBeInTheDocument();
      });
      expect(screen.getByText('Soap')).toBeInTheDocument();
      expect(screen.getByText('How is the family?')).toBeInTheDocument();
      expect(screen.getByText('Doing well')).toBeInTheDocument();
      expect(screen.getByText('Original notes')).toBeInTheDocument();
    });
  });

  describe('Inline editing', () => {
    it('should expose every editable field when Edit is clicked', async () => {
      await renderAndEdit();

      expect(screen.getByLabelText('Visit Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Trainings Received')).toBeInTheDocument();
      expect(screen.getByLabelText('Resources Received')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      // Existing question answers are editable inline.
      expect(screen.getByDisplayValue('Doing well')).toBeInTheDocument();
    });

    it('should leave edit mode without saving when Cancel is clicked', async () => {
      await renderAndEdit();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByLabelText('Visit Date')).not.toBeInTheDocument();
      });
      expect(visitsApi.updateFamilyVisit).not.toHaveBeenCalled();
    });

    it('should send only the changed fields', async () => {
      await renderAndEdit();

      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated notes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(visitsApi.updateFamilyVisit).toHaveBeenCalledWith(42, 7, { notes: 'Updated notes' });
      });
    });

    it('should save edited question answers', async () => {
      await renderAndEdit();

      fireEvent.change(screen.getByDisplayValue('Doing well'), { target: { value: 'Struggling' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(visitsApi.updateFamilyVisit).toHaveBeenCalledWith(42, 7, {
          questions: [{ questionId: 5, question: 'How is the family?', answer: 'Struggling' }],
        });
      });
    });

    it('should save added trainings and removed resources', async () => {
      await renderAndEdit();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Hygiene' })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Trainings Received'), { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Remove resource Soap' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(visitsApi.updateFamilyVisit).toHaveBeenCalledWith(42, 7, {
          trainingsReceived: [
            { id: 1, title: 'Nutrition' },
            { id: 2, title: 'Hygiene' },
          ],
          resourcesReceived: [],
        });
      });
    });

    it('should return to the read view after a successful save', async () => {
      await renderAndEdit();

      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated notes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.queryByLabelText('Visit Date')).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete', () => {
    const openDeleteDialog = async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      return within(await screen.findByRole('dialog'));
    };

    it('should open the ConfirmDialog rather than window.confirm', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');

      const dialog = await openDeleteDialog();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(dialog.getByText('Delete family visit')).toBeInTheDocument();
      expect(dialog.getByText(/This cannot be undone/)).toBeInTheDocument();
      expect(visitsApi.deleteFamilyVisit).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('should not delete when the dialog is cancelled', async () => {
      const dialog = await openDeleteDialog();

      fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(visitsApi.deleteFamilyVisit).not.toHaveBeenCalled();
    });

    it('should delete the visit and navigate back to the family page', async () => {
      const dialog = await openDeleteDialog();

      fireEvent.click(dialog.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(visitsApi.deleteFamilyVisit).toHaveBeenCalledWith(42, 7);
        expect(mockNavigate).toHaveBeenCalledWith('/families/42');
      });
    });

    it('should hide the Delete button from caseworkers', async () => {
      mockAuthUser.role = 'CASEWORKER';

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });
  });
});
