import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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

/** Build a rejection that looks like an axios error carrying the API body. */
const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    response: { data: { error: message } },
  });

const mockCommunities: LookupRead[] = [
  { id: 1, title: 'Community A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Community B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockTrainings: LookupRead[] = [
  { id: 1, title: 'Basic Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Advanced Training', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// The API flattens each junction row to the lookup's own { id, title }
// (see listBirthingAssistants in birthing-assistant.service.ts).
const mockBirthingAssistants: BirthingAssistantRead[] = [
  {
    id: 1,
    localId: null,
    name: 'Maria Santos',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    servedCommunities: [{ id: 1, title: 'Community A' }],
    trainingsReceived: [
      { id: 1, title: 'Basic Training' },
      { id: 2, title: 'Advanced Training' },
    ],
  },
  {
    id: 2,
    localId: null,
    name: 'Ana Rodriguez',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    servedCommunities: [
      { id: 1, title: 'Community A' },
      { id: 2, title: 'Community B' },
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

/** Row-level Delete buttons, excluding the confirm dialog's own Delete button. */
const getRowDeleteButtons = () =>
  screen
    .getAllByRole('button', { name: 'Delete' })
    .filter((button) => button.closest('[role="dialog"]') === null);

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
    });

    // Check table headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Communities Served')).toBeInTheDocument();
    expect(screen.getByText('Trainings Received')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check birthing assistant data
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Ana Rodriguez')).toBeInTheDocument();

    // Check communities and trainings (titles come straight off the record)
    expect(screen.getByText('Community A')).toBeInTheDocument();
    expect(screen.getByText('Community A, Community B')).toBeInTheDocument();
    expect(screen.getByText('Basic Training, Advanced Training')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getAllByText('Edit')).toHaveLength(2);
    expect(getRowDeleteButtons()).toHaveLength(2);
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
    vi.mocked(birthingAssistantsApi.createBirthingAssistant).mockResolvedValue(mockBirthingAssistants[0]!);

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
    fireEvent.click(editButtons[0]!); // Edit Maria Santos

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

    // Selected associations are also listed as removable chips
    expect(screen.getByRole('button', { name: 'Remove community Community A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove training Basic Training' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove training Advanced Training' })).toBeInTheDocument();
  });

  it('should update birthing assistant, sending only changed fields', async () => {
    const user = userEvent.setup();
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.updateBirthingAssistant).mockResolvedValue(mockBirthingAssistants[0]!);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    // Edit first birthing assistant
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]!);

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
      // trainingIds were untouched, so they are not resent (the server drops and
      // recreates every junction row it receives)
      expect(birthingAssistantsApi.updateBirthingAssistant).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        communityIds: [1, 2], // A was already selected, B was toggled on
      });
    });
  });

  it('should remove an individual association from the chip list', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.updateBirthingAssistant).mockResolvedValue(mockBirthingAssistants[0]!);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[0]!); // Maria Santos

    await waitFor(() => {
      expect(screen.getByText('Selected: 2 trainings')).toBeInTheDocument();
    });

    // Remove one training association, keep the other
    fireEvent.click(screen.getByRole('button', { name: 'Remove training Basic Training' }));

    expect(screen.getByText('Selected: 1 trainings')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Basic Training/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Advanced Training/ })).toBeChecked();

    // Remove the only community association
    fireEvent.click(screen.getByRole('button', { name: 'Remove community Community A' }));
    expect(screen.getByText('Selected: 0 communities')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(birthingAssistantsApi.updateBirthingAssistant).toHaveBeenCalledWith(1, {
        communityIds: [],
        trainingIds: [2],
      });
    });
  });

  it('should still allow removing an association whose lookup row was deleted', async () => {
    // Community 2 no longer exists in the lookup list (soft-deleted), but the
    // record still references it — it must remain visible and removable.
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue([mockCommunities[0]!]);
    vi.mocked(birthingAssistantsApi.updateBirthingAssistant).mockResolvedValue(mockBirthingAssistants[1]!);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!); // Ana Rodriguez, communities [1, 2]

    await waitFor(() => {
      expect(screen.getByText('Selected: 2 communities')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: 'Remove community Community B' });
    fireEvent.click(removeButton);

    expect(screen.getByText('Selected: 1 communities')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(birthingAssistantsApi.updateBirthingAssistant).toHaveBeenCalledWith(2, {
        communityIds: [1],
      });
    });
  });

  it('should delete birthing assistant through the confirm dialog', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.deleteBirthingAssistant).mockResolvedValue(undefined);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(getRowDeleteButtons()[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete birthing assistant')).toBeInTheDocument();
    expect(within(dialog).getByText(/Maria Santos/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(birthingAssistantsApi.deleteBirthingAssistant).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not delete when the confirm dialog is cancelled', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.deleteBirthingAssistant).mockResolvedValue(undefined);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[0]!);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(birthingAssistantsApi.deleteBirthingAssistant).not.toHaveBeenCalled();
  });

  it('should never call window.confirm', async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', {
      value: confirmSpy,
      writable: true,
      configurable: true,
    });

    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.deleteBirthingAssistant).mockResolvedValue(undefined);

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[0]!);
    await screen.findByRole('dialog');

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('should surface the server message when a delete is rejected', async () => {
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.deleteBirthingAssistant).mockRejectedValue(
      apiError('Birthing assistant not found')
    );

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Birthing assistant not found')).toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should surface the server message when an update is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(birthingAssistantsApi.fetchBirthingAssistants).mockResolvedValue(mockBirthingAssistants);
    vi.mocked(birthingAssistantsApi.updateBirthingAssistant).mockRejectedValue(
      apiError('One or more communities not found')
    );

    renderWithProviders(<AdminBirthingAssistantsPage />);

    await waitFor(() => {
      expect(screen.getByText('Birthing Assistants (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[0]!);
    const nameInput = screen.getByDisplayValue('Maria Santos');
    await user.clear(nameInput);
    await user.type(nameInput, 'Another Name');
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Failed to update birthing assistant: One or more communities not found'
        )
      ).toBeInTheDocument();
    });
    // The form stays open so the edit is not lost
    expect(screen.getByText('Edit Birthing Assistant')).toBeInTheDocument();
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
