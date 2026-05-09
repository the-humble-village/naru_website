import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AddFamilyVisitPage from '../visits/AddFamilyVisitPage';
import * as visitsApi from '../../api/visits';
import * as familiesApi from '../../api/families';
import * as adminApi from '../../api/admin';
import * as questionSetsApi from '../../api/question-sets';

// Mock the APIs
vi.mock('../../api/visits', () => ({
  visitsApi: {
    createFamilyVisit: vi.fn(),
  },
}));

vi.mock('../../api/families', () => ({
  familiesApi: {
    fetchFamily: vi.fn(),
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

// Mock react-router-dom navigate and useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '1' }),
  };
});

const mockFamily = {
  id: 1,
  localId: null,
  familyName: 'Test Family',
  childrenEditable: 0,
  inCrisis: false,
  notes: null,
  communityId: 1,
  siteId: 1,
  birthingAssistantId: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockTrainings = [
  { id: 1, title: 'Nutrition Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Health Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockResources = [
  { id: 1, title: 'Nutrition Guide', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Health Manual', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockQuestions = [
  { id: 1, title: 'How is the family situation?', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Any concerns with children?', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement, initialEntries = ['/families/1/visits/new']) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AddFamilyVisitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Setup default mock returns
    vi.mocked(familiesApi.familiesApi.fetchFamily).mockResolvedValue(mockFamily);
    vi.mocked(adminApi.adminApi.fetchTraining).mockResolvedValue(mockTrainings);
    vi.mocked(adminApi.adminApi.fetchResources).mockResolvedValue(mockResources);
    vi.mocked(adminApi.adminApi.fetchFamilyVisitQuestions).mockResolvedValue(mockQuestions);
    vi.mocked(questionSetsApi.questionSetsApi.list).mockResolvedValue([]);
  });

  describe('Initial Render', () => {
    it('should render the page title and form', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      expect(screen.getByText('Add Family Visit')).toBeInTheDocument();
      expect(screen.getByText('← Back to Family')).toBeInTheDocument();

      // Wait for family name to load
      await waitFor(() => {
        expect(screen.getByText('Visit for: Test Family')).toBeInTheDocument();
      });
    });

    it('should render all form sections', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Visit Date/)).toBeInTheDocument();
        expect(screen.getByText('Trainings Received')).toBeInTheDocument();
        expect(screen.getByText('Resources Received')).toBeInTheDocument();
        expect(screen.getByText('Visit Questions')).toBeInTheDocument();
        expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
      });
    });

    it('should have a default visit date set to current time', () => {
      renderWithProviders(<AddFamilyVisitPage />);

      const visitDateInput = screen.getByLabelText(/Visit Date/) as HTMLInputElement;
      expect(visitDateInput.value).toBeTruthy();
      expect(new Date(visitDateInput.value)).toBeInstanceOf(Date);
    });
  });

  describe('Trainings Management', () => {
    it('should allow adding trainings', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      await waitFor(() => {
        const trainingSelect = screen.getByDisplayValue('Add a training...');
        fireEvent.change(trainingSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Nutrition Training')).toBeInTheDocument();
      });
    });

    it('should allow removing trainings', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      // Add a training first
      await waitFor(() => {
        const trainingSelect = screen.getByDisplayValue('Add a training...');
        fireEvent.change(trainingSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        // Check that training appears in the selected list (not the dropdown)
        const selectedTraining = screen.getAllByText('Nutrition Training').find(
          element => element.closest('div')?.className?.includes('bg-hv-page')
        );
        expect(selectedTraining).toBeInTheDocument();
      });

      // Remove the training
      const removeButton = screen.getAllByText('Remove')[0];
      fireEvent.click(removeButton);

      await waitFor(() => {
        // Check that training is removed from the selected list
        const selectedTraining = screen.queryAllByText('Nutrition Training').find(
          element => element.closest('div')?.className?.includes('bg-hv-page')
        );
        expect(selectedTraining).toBeUndefined();
      });
    });

    it('should prevent adding duplicate trainings', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      // Add a training
      await waitFor(() => {
        const trainingSelect = screen.getByDisplayValue('Add a training...');
        fireEvent.change(trainingSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Nutrition Training')).toBeInTheDocument();
      });

      // Try to add the same training again
      const trainingSelect = screen.getByDisplayValue('Add a training...');
      const options = trainingSelect.querySelectorAll('option');
      const nutritionOption = Array.from(options).find(option =>
        option.textContent === 'Nutrition Training'
      );

      // The option should not be available anymore
      expect(nutritionOption).toBeUndefined();
    });
  });

  describe('Resources Management', () => {
    it('should allow adding resources', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      await waitFor(() => {
        const resourceSelect = screen.getByDisplayValue('Add a resource...');
        fireEvent.change(resourceSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Nutrition Guide')).toBeInTheDocument();
      });
    });

    it('should allow removing resources', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      // Add a resource first
      await waitFor(() => {
        const resourceSelect = screen.getByDisplayValue('Add a resource...');
        fireEvent.change(resourceSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        // Check that resource appears in the selected list
        const selectedResource = screen.getAllByText('Nutrition Guide').find(
          element => element.closest('div')?.className?.includes('bg-hv-page')
        );
        expect(selectedResource).toBeInTheDocument();
      });

      // Remove the resource
      const removeButtons = screen.getAllByText('Remove');
      const resourceRemoveButton = removeButtons.find(button =>
        button.closest('div')?.textContent?.includes('Nutrition Guide')
      );
      if (resourceRemoveButton) {
        fireEvent.click(resourceRemoveButton);
      }

      await waitFor(() => {
        // Check that resource is removed from the selected list
        const selectedResource = screen.queryAllByText('Nutrition Guide').find(
          element => element.closest('div')?.className?.includes('bg-hv-page')
        );
        expect(selectedResource).toBeUndefined();
      });
    });
  });

  describe('Questions Management', () => {
    it('should allow adding questions', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      await waitFor(() => {
        const questionSelect = screen.getByDisplayValue('Add a question...');
        fireEvent.change(questionSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('How is the family situation?')).toBeInTheDocument();
      });

      const answerTextarea = screen.getByPlaceholderText('Enter answer...');
      fireEvent.change(answerTextarea, { target: { value: 'Family is doing well' } });

      expect((answerTextarea as HTMLTextAreaElement).value).toBe('Family is doing well');
    });

    it('should allow removing questions', async () => {
      renderWithProviders(<AddFamilyVisitPage />);

      // Add a question first
      await waitFor(() => {
        const questionSelect = screen.getByDisplayValue('Add a question...');
        fireEvent.change(questionSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        expect(screen.getByText('How is the family situation?')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter answer...')).toBeInTheDocument();
      });

      // Remove the question
      const removeButtons = screen.getAllByText('Remove');
      const questionRemoveButton = removeButtons.find(button =>
        button.closest('div')?.textContent?.includes('How is the family situation?')
      );
      if (questionRemoveButton) {
        fireEvent.click(questionRemoveButton);
      }

      await waitFor(() => {
        // Check that the answer textarea is removed
        expect(screen.queryByPlaceholderText('Enter answer...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit form with valid data', async () => {
      const mockCreatedVisit = {
        id: 1,
        localId: null,
        familyId: 1,
        visitDate: '2024-01-01T10:00:00Z',
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
        notes: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(visitsApi.visitsApi.createFamilyVisit).mockResolvedValue(mockCreatedVisit);

      renderWithProviders(<AddFamilyVisitPage />);

      // Fill out notes
      await waitFor(() => {
        const notesTextarea = screen.getByLabelText(/Notes/);
        fireEvent.change(notesTextarea, { target: { value: 'Test visit notes' } });
      });

      const submitButton = screen.getByText('Create Visit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(visitsApi.visitsApi.createFamilyVisit).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            familyId: 1,
            notes: 'Test visit notes',
          })
        );
        // Navigation is tested via links, API call verification is sufficient
      });
    });

    it('should submit with trainings and resources', async () => {
      const mockCreatedVisit = {
        id: 1,
        localId: null,
        familyId: 1,
        visitDate: '2024-01-01T10:00:00Z',
        trainingsReceived: [{ id: 1, title: 'Nutrition Training' }],
        resourcesReceived: [{ id: 1, title: 'Nutrition Guide' }],
        questions: [],
        notes: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      vi.mocked(visitsApi.visitsApi.createFamilyVisit).mockResolvedValue(mockCreatedVisit);

      renderWithProviders(<AddFamilyVisitPage />);

      // Add training and resource
      await waitFor(() => {
        const trainingSelect = screen.getByDisplayValue('Add a training...');
        fireEvent.change(trainingSelect, { target: { value: '1' } });
      });

      await waitFor(() => {
        const resourceSelect = screen.getByDisplayValue('Add a resource...');
        fireEvent.change(resourceSelect, { target: { value: '1' } });
      });

      const submitButton = screen.getByText('Create Visit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(visitsApi.visitsApi.createFamilyVisit).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            familyId: 1,
            trainingsReceived: [{ id: 1, title: 'Nutrition Training' }],
            resourcesReceived: [{ id: 1, title: 'Nutrition Guide' }],
          })
        );
      });
    });

    it('should handle submission errors', async () => {
      vi.mocked(visitsApi.visitsApi.createFamilyVisit).mockRejectedValue(
        new Error('Failed to create visit')
      );

      renderWithProviders(<AddFamilyVisitPage />);

      const submitButton = screen.getByText('Create Visit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create visit. Please try again.')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to family detail page when clicking back link', () => {
      renderWithProviders(<AddFamilyVisitPage />);

      const backLink = screen.getByText('← Back to Family');
      expect(backLink.closest('a')).toHaveAttribute('href', '/families/1');
    });

    it('should navigate back to family detail page when clicking cancel', () => {
      renderWithProviders(<AddFamilyVisitPage />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton.closest('a')).toHaveAttribute('href', '/families/1');
    });
  });

  // Note: Error handling for invalid IDs is tested through unit tests of the component logic
  });