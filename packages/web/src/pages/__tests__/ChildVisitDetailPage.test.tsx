import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ChildVisitDetailPage from '../visits/ChildVisitDetailPage';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { questionSetsApi } from '../../api/question-sets';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/visits', () => ({
  visitsApi: {
    fetchChildVisit: vi.fn(),
    updateChildVisit: vi.fn(),
    deleteChildVisit: vi.fn(),
  },
}));

vi.mock('../../api/children', () => ({
  childrenApi: {
    fetchChild: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchChildVisitQuestions: vi.fn(),
  },
}));

vi.mock('../../api/question-sets', () => ({
  questionSetsApi: {
    list: vi.fn(),
  },
}));

vi.mock('../../api/files', () => ({
  filesApi: {
    getPresignedDownloadUrls: vi.fn().mockResolvedValue({ urls: [] }),
    requestPresignedUpload: vi.fn(),
    uploadFileToS3: vi.fn(),
    confirmUpload: vi.fn(),
  },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => mockNavigate,
  };
});

const mockFetchVisit = visitsApi.fetchChildVisit as ReturnType<typeof vi.fn>;
const mockUpdateVisit = visitsApi.updateChildVisit as ReturnType<typeof vi.fn>;
const mockDeleteVisit = visitsApi.deleteChildVisit as ReturnType<typeof vi.fn>;
const mockFetchChild = childrenApi.fetchChild as ReturnType<typeof vi.fn>;
const mockFetchQuestions = adminApi.fetchChildVisitQuestions as ReturnType<typeof vi.fn>;
const mockListSets = questionSetsApi.list as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const setRole = (role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER') => {
  mockUseAuthStore.mockReturnValue({
    user: { id: 1, login: 'u', email: null, firstName: 'A', lastName: 'B', role, lang: 'en' },
  });
};

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
};

// visitDate is a timestamp: build it from local parts so the datetime-local
// assertions are timezone-independent.
const VISIT_DATE = new Date(2023, 2, 1, 10, 30).toISOString();
const VISIT_DATE_LOCAL = '2023-03-01T10:30';

const mockVisit = {
  id: 7,
  localId: null,
  familyId: 1,
  childId: 2,
  visitDate: VISIT_DATE,
  weight: 12.5,
  armCircumference: 165,
  height: 850,
  incap: true,
  leche: false,
  bagsGiven: '2 bags',
  recvAnyMedicine: 'Amoxicillin',
  leftFromProg: '',
  passedAway: '',
  questions: [{ questionId: 3, question: 'Eating well?', answer: 'Yes, three meals' }],
  photos: [],
  notes: 'Doing better',
  createdAt: '2023-03-01T10:00:00.000Z',
  updatedAt: '2023-03-01T10:00:00.000Z',
};

const mockChild = {
  id: 2,
  localId: null,
  familyId: 1,
  name: 'Maria Garcia',
  birthDate: '2023-01-15T00:00:00.000Z',
  sex: 'FEMALE' as const,
  dateEntered: null,
  photos: [],
  weight: 12.5,
  nutritionalState: null,
  reasonEnrollment: null,
  observations: null,
  createdAt: '2023-01-15T10:00:00.000Z',
  updatedAt: '2023-03-15T10:00:00.000Z',
};

const renderPage = async () => {
  render(<ChildVisitDetailPage />, { wrapper: createTestWrapper() });
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
};

const openEditForm = async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByText('Edit Visit');
};

describe('ChildVisitDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setRole('SUPERVISOR');
    mockFetchVisit.mockResolvedValue(mockVisit);
    mockFetchChild.mockResolvedValue(mockChild);
    mockFetchQuestions.mockResolvedValue([
      { id: 3, title: 'Eating well?' },
      { id: 4, title: 'Sleeping well?' },
    ]);
    mockListSets.mockResolvedValue([]);
    const { useParams } = await import('react-router-dom');
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: '1', cid: '2', vid: '7' });
  });

  describe('Read view', () => {
    it('shows loading then the visit', async () => {
      mockFetchVisit.mockReturnValue(new Promise(() => {}));
      render(<ChildVisitDetailPage />, { wrapper: createTestWrapper() });
      expect(screen.getByText('Loading visit...')).toBeInTheDocument();
    });

    it('renders measurements and the free-text status fields as text, not booleans', async () => {
      await renderPage();

      expect(screen.getByText('12.50 kg')).toBeInTheDocument();
      expect(screen.getByText('16.5 cm')).toBeInTheDocument();
      expect(screen.getByText('85.0 cm')).toBeInTheDocument();
      // bagsGiven / recvAnyMedicine are strings — the recorded value must be visible
      expect(screen.getByText('2 bags')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
      expect(screen.getByText('Doing better')).toBeInTheDocument();
    });

    it('renders the question text alongside the answer', async () => {
      await renderPage();

      expect(screen.getByText('Eating well?')).toBeInTheDocument();
      expect(screen.getByText('Yes, three meals')).toBeInTheDocument();
      expect(screen.queryByText(/^Q3:/)).not.toBeInTheDocument();
    });

    it('shows an error when the visit cannot be loaded', async () => {
      mockFetchVisit.mockRejectedValue(new Error('nope'));
      render(<ChildVisitDetailPage />, { wrapper: createTestWrapper() });

      expect(await screen.findByText('Visit not found')).toBeInTheDocument();
    });

    it('rejects invalid route params', async () => {
      const { useParams } = await import('react-router-dom');
      (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'x', cid: 'x', vid: 'x' });

      render(<ChildVisitDetailPage />, { wrapper: createTestWrapper() });

      expect(screen.getByText('Invalid family, child, or visit ID in URL')).toBeInTheDocument();
      expect(mockFetchVisit).not.toHaveBeenCalled();
    });
  });

  describe('Inline edit', () => {
    it('prefills every visit field', async () => {
      await openEditForm();

      expect(screen.getByLabelText('Visit Date')).toHaveValue(VISIT_DATE_LOCAL);
      expect(screen.getByLabelText('Weight (kg)')).toHaveValue(12.5);
      expect(screen.getByLabelText('Arm Circumference (mm)')).toHaveValue(165);
      expect(screen.getByLabelText('Height (mm)')).toHaveValue(850);
      expect(screen.getByLabelText('Gave special drink (INCAP)')).toBeChecked();
      expect(screen.getByLabelText('Drinking milk (Leche)')).not.toBeChecked();
      expect(screen.getByLabelText('Bags Given')).toHaveValue('2 bags');
      expect(screen.getByLabelText('Received Medicine')).toHaveValue('Amoxicillin');
      expect(screen.getByLabelText('Left Program')).toHaveValue('');
      expect(screen.getByLabelText('Passed Away')).toHaveValue('');
      expect(screen.getByLabelText('Notes')).toHaveValue('Doing better');
      // Existing answers are editable through the shared questions panel
      expect(screen.getByDisplayValue('Yes, three meals')).toBeInTheDocument();
      // Photos are editable
      expect(screen.getByText('Add Photo')).toBeInTheDocument();
    });

    it('sends only the changed fields', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '13.2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, { weight: 13.2 });
      });
    });

    it('saves an edited question answer', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      fireEvent.change(screen.getByDisplayValue('Yes, three meals'), { target: { value: 'Only twice' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, {
          questions: [{ questionId: 3, question: 'Eating well?', answer: 'Only twice' }],
        });
      });
    });

    it('drops a removed question from the payload', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, { questions: [] });
      });
    });

    it('clears a free-text field to null rather than an empty string', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      fireEvent.change(screen.getByLabelText('Bags Given'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, { bagsGiven: null });
      });
    });

    it('round-trips the visit date without shifting it', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      // Save without touching the date: it must not be part of the diff
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated note' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, { notes: 'Updated note' });
      });
    });

    it('sends the new visit date when it changes', async () => {
      mockUpdateVisit.mockResolvedValue(mockVisit);
      await openEditForm();

      fireEvent.change(screen.getByLabelText('Visit Date'), { target: { value: '2023-03-02T09:00' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockUpdateVisit).toHaveBeenCalledWith(1, 2, 7, {
          visitDate: new Date(2023, 2, 2, 9, 0).toISOString(),
        });
      });
    });

    it('cancel discards changes', async () => {
      await openEditForm();

      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'nope' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Edit Visit')).not.toBeInTheDocument();
      });
      expect(mockUpdateVisit).not.toHaveBeenCalled();
    });

    it('surfaces a save error', async () => {
      mockUpdateVisit.mockRejectedValue(new Error('Boom'));
      await openEditForm();

      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'x' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText(/Error saving visit: Boom/)).toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    it('hides the Delete button from caseworkers', async () => {
      setRole('CASEWORKER');
      await renderPage();

      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('uses ConfirmDialog rather than window.confirm', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete visit')).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockDeleteVisit).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('cancelling does not delete', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockDeleteVisit).not.toHaveBeenCalled();
    });

    it('confirming deletes and navigates back to the child', async () => {
      mockDeleteVisit.mockResolvedValue(undefined);
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(mockDeleteVisit).toHaveBeenCalledWith(1, 2, 7);
      });
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/families/1/children/2');
      });
    });

    it('surfaces a delete error and stays on the page', async () => {
      mockDeleteVisit.mockRejectedValue(new Error('Forbidden'));
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(/Error deleting visit: Forbidden/)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
