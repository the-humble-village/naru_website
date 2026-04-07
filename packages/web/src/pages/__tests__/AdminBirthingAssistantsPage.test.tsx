import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminBirthingAssistantsPage } from '../admin/AdminBirthingAssistantsPage';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { adminApi } from '../../api/admin';
import { BirthingAssistantRead, LookupRead } from '@naru/shared';

// Mock the APIs
vi.mock('../../api/birthing-assistants', () => ({
  birthingAssistantsApi: {
    fetchBirthingAssistants: vi.fn(),
    createBirthingAssistant: vi.fn(),
    updateBirthingAssistant: vi.fn(),
    deleteBirthingAssistant: vi.fn(),
  },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchCommunities: vi.fn(),
    fetchTraining: vi.fn(),
  },
}));

// Mock the auth store
const mockSupervisorUser = {
  id: 1,
  login: 'supervisor',
  email: 'supervisor@test.com',
  firstName: 'Super',
  lastName: 'Visor',
  role: 'SUPERVISOR' as const,
  lang: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  localId: null,
};

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    user: mockSupervisorUser,
  }),
}));

const mockCommunities: LookupRead[] = [
  { id: 1, title: 'Community A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Community B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockTrainings: LookupRead[] = [
  { id: 1, title: 'Basic Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Advanced Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockBirthingAssistants: BirthingAssistantRead[] = [
  {
    id: 1,
    localId: null,
    name: 'Maria Santos',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    servedCommunities: [
      { communityId: 1, community: { id: 1, title: 'Community A' } as any },
    ],
    trainingsReceived: [
      { trainingId: 1, training: { id: 1, title: 'Basic Training' } as any },
      { trainingId: 2, training: { id: 2, title: 'Advanced Training' } as any },
    ],
  },
  {
    id: 2,
    localId: null,
    name: 'Ana Rodriguez',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    servedCommunities: [
      { communityId: 1, community: { id: 1, title: 'Community A' } as any },
      { communityId: 2, community: { id: 2, title: 'Community B' } as any },
    ],
    trainingsReceived: [],
  },
];

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('AdminBirthingAssistantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue(mockCommunities);
    vi.mocked(adminApi.fetchTraining).mockResolvedValue(mockTrainings);
  });

  it('should render page title and back link', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    expect(screen.getByText('Birthing Assistants')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to Admin' })).toHaveAttribute('href', '/admin');
  });

  it('should show loading state', () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<AdminBirthingAssistantsPage />);

    expect(screen.getByText('Loading birthing assistants...')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockRejectedValue(new Error('API Error'));

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load birthing assistants: API Error')).toBeInTheDocument();
    });
  });

  it('should display birthing assistants table with correct data', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();

      // Check table headers
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Communities Served')).toBeInTheDocument();
      expect(screen.getByText('Trainings Received')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check birthing assistant data
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Ana Rodriguez')).toBeInTheDocument();

      // Check communities and trainings
      expect(screen.getByText('Community A')).toBeInTheDocument();
      expect(screen.getByText('Community A, Community B')).toBeInTheDocument();
      expect(screen.getByText('Basic Training, Advanced Training')).toBeInTheDocument();

      // Check action buttons
      expect(screen.getAllByText('Edit')).toHaveLength(2);
      expect(screen.getAllByText('Delete')).toHaveLength(2);
    });
  });

  it('should show create form when add button clicked', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    expect(screen.getByText('Add New Birthing Assistant')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByText('Served Communities')).toBeInTheDocument();
    // "Trainings Received" appears in both form label and table header
    expect(screen.getAllByText('Trainings Received').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should display communities and trainings as checkboxes', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    await waitFor(() => {
      // Communities appear in both table data and form checkboxes
      // Verify checkboxes are present by role
      expect(screen.getByRole('checkbox', { name: /Community A/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Community B/ })).toBeInTheDocument();

      // Training checkboxes
      expect(screen.getByRole('checkbox', { name: /Basic Training/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Advanced Training/ })).toBeInTheDocument();

      // Check counters
      expect(screen.getByText('Selected: 0 communities')).toBeInTheDocument();
      expect(screen.getByText('Selected: 0 trainings')).toBeInTheDocument();
    });
  });

  it('should create new birthing assistant successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.createBirthingAssistant).mockResolvedValue(mockBirthingAssistants[0]);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    // Wait for communities/trainings checkboxes to load
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Community A/ })).toBeInTheDocument();
    });

    // Fill name
    await user.type(screen.getByLabelText(/Name/), 'New Birthing Assistant');

    // Select a community
    fireEvent.click(screen.getByRole('checkbox', { name: /Community A/ }));

    // Select a training
    fireEvent.click(screen.getByRole('checkbox', { name: /Basic Training/ }));

    // Submit form
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(birthingAssistantsApi.createBirthingAssistant).toHaveBeenCalledWith(
        {
          name: 'New Birthing Assistant',
          communityIds: [1],
          trainingIds: [1],
        },
        expect.anything(),
      );
    });
  });

  it('should show edit form when edit button clicked', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]); // Edit Maria Santos

    await waitFor(() => {
      expect(screen.getByText('Edit Birthing Assistant')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Maria Santos')).toBeInTheDocument();

      // Check that pre-existing selections are checked
      const communityACheckbox = screen.getByRole('checkbox', { name: /Community A/ });
      const communityBCheckbox = screen.getByRole('checkbox', { name: /Community B/ });
      const basicTrainingCheckbox = screen.getByRole('checkbox', { name: /Basic Training/ });
      const advancedTrainingCheckbox = screen.getByRole('checkbox', { name: /Advanced Training/ });

      expect(communityACheckbox).toBeChecked();
      expect(communityBCheckbox).not.toBeChecked();
      expect(basicTrainingCheckbox).toBeChecked();
      expect(advancedTrainingCheckbox).toBeChecked();
    });
  });

  it('should update birthing assistant successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.updateBirthingAssistant).mockResolvedValue(mockBirthingAssistants[0]);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    // Edit first birthing assistant
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Birthing Assistant')).toBeInTheDocument();
    });

    // Modify name
    const nameInput = screen.getByDisplayValue('Maria Santos');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    // Toggle community selection
    const communityBCheckbox = screen.getByRole('checkbox', { name: /Community B/ });
    fireEvent.click(communityBCheckbox);

    // Submit
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(birthingAssistantsApi.updateBirthingAssistant).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        communityIds: [1, 2], // A was already selected, B was toggled on
        trainingIds: [1, 2], // Both trainings were pre-selected
      });
    });
  });

  it('should delete birthing assistant when delete button clicked and confirmed', async () => {
    // Mock window.confirm
    const mockConfirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { value: mockConfirm, writable: true, configurable: true });

    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.deleteBirthingAssistant).mockResolvedValue(undefined as any);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete "Maria Santos"?');

    await waitFor(() => {
      expect(birthingAssistantsApi.deleteBirthingAssistant).toHaveBeenCalledWith(1, expect.anything());
    });
  });

  it('should cancel form when cancel button clicked', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add Birthing Assistant'));
    expect(screen.getByText('Add New Birthing Assistant')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add New Birthing Assistant')).not.toBeInTheDocument();
  });

  it('should handle empty birthing assistants list', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue([]);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (0)')).toBeInTheDocument();
      expect(screen.getByText('No birthing assistants found. Create your first birthing assistant to get started.')).toBeInTheDocument();
    });
  });

  it('should handle empty communities and trainings lists', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue([]);
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue([]);
    vi.mocked(adminApi.fetchTraining).mockResolvedValue([]);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (0)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    await waitFor(() => {
      expect(screen.getByText('No communities available')).toBeInTheDocument();
      expect(screen.getByText('No trainings available')).toBeInTheDocument();
    });
  });

  it('should disable create button when name is empty', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    const createButton = screen.getByText('Create');
    expect(createButton).toBeDisabled();
  });

  it('should update selection counters when checkboxes are toggled', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Birthing Assistant'));

    await waitFor(() => {
      expect(screen.getByText('Selected: 0 communities')).toBeInTheDocument();
      expect(screen.getByText('Selected: 0 trainings')).toBeInTheDocument();
    });

    // Select a community
    const communityCheckbox = screen.getByRole('checkbox', { name: /Community A/ });
    fireEvent.click(communityCheckbox);

    expect(screen.getByText('Selected: 1 communities')).toBeInTheDocument();

    // Select a training
    const trainingCheckbox = screen.getByRole('checkbox', { name: /Basic Training/ });
    fireEvent.click(trainingCheckbox);

    expect(screen.getByText('Selected: 1 trainings')).toBeInTheDocument();
  });
});