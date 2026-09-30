import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AddFamilyPage from '../families/AddFamilyPage';
import * as familiesApi from '../../api/families';
import * as adminApi from '../../api/admin';
import * as birthingAssistantsApi from '../../api/birthing-assistants';

// Mock the APIs
vi.mock('../../api/families', () => ({
  familiesApi: {
    createFamily: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchCommunities: vi.fn(),
    fetchSites: vi.fn(),
  },
}));

vi.mock('../../api/birthing-assistants', () => ({
  birthingAssistantsApi: {
    fetchBirthingAssistants: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCommunities = [
  { id: 1, title: 'Community A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Community B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockSites = [
  { id: 1, title: 'Site A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Site B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockBirthingAssistants = [
  {
    id: 1,
    name: 'Assistant A',
    localId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Assistant B',
    localId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AddFamilyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    (adminApi.adminApi.fetchCommunities as any).mockResolvedValue(mockCommunities);
    (adminApi.adminApi.fetchSites as any).mockResolvedValue(mockSites);
    (birthingAssistantsApi.birthingAssistantsApi.fetchBirthingAssistants as any).mockResolvedValue(mockBirthingAssistants);
  });

  it('renders add family form', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Add Family')).toBeInTheDocument();
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Community')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone')).toBeInTheDocument();
      expect(screen.getByLabelText('Second caretaker')).toBeInTheDocument();
      expect(screen.getByLabelText('Income sources')).toBeInTheDocument();
      expect(screen.getByLabelText('Family is in crisis')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Family' })).toBeInTheDocument();
    });
  });

  it('loads and displays lookup data in selectors', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Community')).toBeInTheDocument();
    });

    // A family has no site of its own — Site is a rollup of Community — and the
    // birthing assistant moved to the pregnancy enrollment.
    expect(screen.queryByLabelText('Site')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Birthing Assistant')).not.toBeInTheDocument();

    expect(adminApi.adminApi.fetchCommunities).toHaveBeenCalled();
  });

  it('updates form data when inputs change', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    const familyNameInput = screen.getByLabelText('Family Name');
    const notesInput = screen.getByLabelText('Notes');
    const crisisCheckbox = screen.getByLabelText('Family is in crisis');

    fireEvent.change(familyNameInput, { target: { value: 'Test Family' } });
    fireEvent.change(notesInput, { target: { value: 'Test notes' } });
    fireEvent.click(crisisCheckbox);

    expect(familyNameInput).toHaveValue('Test Family');
    expect(notesInput).toHaveValue('Test notes');
    expect(crisisCheckbox).toBeChecked();
  });

  it('creates family when valid form is submitted', async () => {
    const mockCreatedFamily = {
      id: 1,
      localId: null,
      familyName: 'Test Family',
      inCrisis: false,
      notes: 'Test notes',
      communityId: 1,
      phone: null,
      caretaker2Name: null,
      incomeSources: null,
      deathsNotes: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    (familiesApi.familiesApi.createFamily as any).mockResolvedValue(mockCreatedFamily);

    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    // Fill form with valid data
    const familyNameInput = screen.getByLabelText('Family Name');
    const communitySelect = screen.getByLabelText('Community');
    const notesInput = screen.getByLabelText('Notes');

    fireEvent.change(familyNameInput, { target: { value: 'Test Family' } });
    fireEvent.change(communitySelect, { target: { value: '1' } });
    fireEvent.change(notesInput, { target: { value: 'Test notes' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Create Family' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(familiesApi.familiesApi.createFamily).toHaveBeenCalled();
      // Check that first argument matches our expected data structure
      const firstCall = (familiesApi.familiesApi.createFamily as any).mock.calls[0];
      const familyData = firstCall[0];
      expect(familyData).toEqual({
        familyName: 'Test Family',
        inCrisis: false,
        notes: 'Test notes',
        communityId: 1,
        phone: null,
        caretaker2Name: null,
        incomeSources: null,
        deathsNotes: null,
      });
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/families/1');
    });
  });

  it('shows validation errors for invalid form data', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    // A second caretaker name longer than the column rejects the whole form.
    const caretaker2 = screen.getByLabelText('Second caretaker');
    fireEvent.change(caretaker2, { target: { value: 'x'.repeat(257) } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Family' }));

    // Wait a bit for any validation to occur
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not call API when validation fails
    expect(familiesApi.familiesApi.createFamily).not.toHaveBeenCalled();
  });

  it('shows error message when family creation fails', async () => {
    (familiesApi.familiesApi.createFamily as any).mockRejectedValue(
      new Error('Failed to create family')
    );

    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    // Fill and submit form
    fireEvent.change(screen.getByLabelText('Family Name'), { target: { value: 'Test Family' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Family' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to create family. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    let resolveMutation: any;
    const mutationPromise = new Promise(resolve => {
      resolveMutation = () => resolve({ id: 1 });
    });

    (familiesApi.familiesApi.createFamily as any).mockReturnValue(mutationPromise);

    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Family Name'), { target: { value: 'Test Family' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Family' }));

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();

    // Resolve mutation to clean up
    resolveMutation();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('navigates to families page when back link is clicked', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    const backLink = screen.getByText('← Back to Families');
    expect(backLink.closest('a')).toHaveAttribute('href', '/families');
  });

  it('navigates to families page when cancel is clicked', async () => {
    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Family Name')).toBeInTheDocument();
    });

    const cancelLink = screen.getByText('Cancel');
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/families');
  });

  it('shows loading spinner while fetching lookup data', () => {
    // Mock pending promises to keep loading state
    (adminApi.adminApi.fetchCommunities as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <TestWrapper>
        <AddFamilyPage />
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});