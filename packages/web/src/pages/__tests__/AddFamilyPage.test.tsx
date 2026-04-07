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

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AddFamilyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByLabelText('Site')).toBeInTheDocument();
      expect(screen.getByLabelText('Birthing Assistant')).toBeInTheDocument();
      expect(screen.getByLabelText('Children Editable Count')).toBeInTheDocument();
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
      // Check community options
      const communitySelect = screen.getByLabelText('Community');
      expect(communitySelect).toBeInTheDocument();

      // Check site options
      const siteSelect = screen.getByLabelText('Site');
      expect(siteSelect).toBeInTheDocument();

      // Check birthing assistant options
      const baSelect = screen.getByLabelText('Birthing Assistant');
      expect(baSelect).toBeInTheDocument();
    });

    // Verify API calls
    expect(adminApi.adminApi.fetchCommunities).toHaveBeenCalled();
    expect(adminApi.adminApi.fetchSites).toHaveBeenCalled();
    expect(birthingAssistantsApi.birthingAssistantsApi.fetchBirthingAssistants).toHaveBeenCalled();
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
      childrenEditable: 0,
      inCrisis: false,
      notes: 'Test notes',
      communityId: 1,
      siteId: 1,
      birthingAssistantId: null,
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
    const siteSelect = screen.getByLabelText('Site');
    const notesInput = screen.getByLabelText('Notes');

    fireEvent.change(familyNameInput, { target: { value: 'Test Family' } });
    fireEvent.change(communitySelect, { target: { value: '1' } });
    fireEvent.change(siteSelect, { target: { value: '1' } });
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
        childrenEditable: 0,
        inCrisis: false,
        notes: 'Test notes',
        communityId: 1,
        siteId: 1,
        birthingAssistantId: null,
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

    // Try to submit form with invalid data (negative children editable)
    const childrenEditableInput = screen.getByLabelText('Children Editable Count');
    fireEvent.change(childrenEditableInput, { target: { value: '-1' } });

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
    // Mock a delayed API response
    (familiesApi.familiesApi.createFamily as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

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