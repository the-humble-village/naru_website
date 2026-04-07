import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminLookupsPage } from '../admin/AdminLookupsPage';
import { adminApi } from '../../api/admin';
import { LookupRead } from '@naru/shared';

// Mock the admin API
vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchLookupTable: vi.fn(),
    createLookupEntry: vi.fn(),
    updateLookupEntry: vi.fn(),
    deleteLookupEntry: vi.fn(),
  },
}));

// Mock react-router-dom useParams
const mockUseParams = vi.fn().mockReturnValue({ table: 'communities' });

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockUseParams(),
  };
});

// Mock the auth store
const mockAdminUser = {
  id: 1,
  login: 'admin',
  email: 'admin@test.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN' as const,
  lang: 'en',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  localId: null,
};

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    user: mockAdminUser,
  }),
}));

const mockCommunities: LookupRead[] = [
  {
    id: 1,
    title: 'Community 1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Community 2',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
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

const renderWithProviders = (
  component: React.ReactElement,
  initialEntries: string[] = ['/admin/communities']
) => {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('AdminLookupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default communities table for each test
    mockUseParams.mockReturnValue({ table: 'communities' });
  });

  it('should render communities page correctly', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities')).toBeInTheDocument();
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
      expect(screen.getByText('Add Community')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '← Back to Admin' })).toHaveAttribute('href', '/admin');
    });
  });

  it('should handle different lookup table types', async () => {
    const testCases = [
      { table: 'sites', title: 'Sites', addButton: 'Add Site' },
      { table: 'resources', title: 'Resources', addButton: 'Add Resource' },
      { table: 'training', title: 'Training', addButton: 'Add Training' },
      { table: 'child-visit-questions', title: 'Child Visit Questions', addButton: 'Add Child Visit Question' },
    ];

    for (const testCase of testCases) {
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([]);

      // Mock useParams for this specific table
      mockUseParams.mockReturnValue({ table: testCase.table });

      const { unmount } = renderWithProviders(<AdminLookupsPage />);

      await waitFor(() => {
        expect(screen.getByText(testCase.title)).toBeInTheDocument();
        expect(screen.getByText(testCase.addButton)).toBeInTheDocument();
      });

      unmount();
    }
  });

  it('should show invalid table error for unsupported table', async () => {
    // Mock useParams for invalid table
    mockUseParams.mockReturnValue({ table: 'invalid-table' });

    renderWithProviders(<AdminLookupsPage />);

    expect(screen.getByText('Invalid Table')).toBeInTheDocument();
    expect(screen.getByText('Invalid lookup table: invalid-table')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(adminApi.fetchLookupTable).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<AdminLookupsPage />);

    expect(screen.getByText('Loading communities...')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockRejectedValue(new Error('API Error'));

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load communities: API Error')).toBeInTheDocument();
    });
  });

  it('should display lookup items table with correct data', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      // Check table headers
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText('Updated')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check item data
      expect(screen.getByText('Community 1')).toBeInTheDocument();
      expect(screen.getByText('Community 2')).toBeInTheDocument();

      // Check action buttons
      expect(screen.getAllByText('Edit')).toHaveLength(2);
      expect(screen.getAllByText('Delete')).toHaveLength(2);
    });
  });

  it('should show create form when add button clicked', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Community'));

    expect(screen.getByText('Add New Community')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter community title')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should create new item successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
    vi.mocked(adminApi.createLookupEntry).mockResolvedValue(mockCommunities[0]);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add Community'));

    // Fill form
    const titleInput = screen.getByLabelText(/Title/);
    await user.type(titleInput, 'New Community');

    // Submit form
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(adminApi.createLookupEntry).toHaveBeenCalledWith('communities', {
        title: 'New Community',
      });
    });
  });

  it('should show edit form when edit button clicked', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit Community')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Community 1')).toBeInTheDocument();
    expect(screen.getByText('Update')).toBeInTheDocument();
  });

  it('should update item successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
    vi.mocked(adminApi.updateLookupEntry).mockResolvedValue(mockCommunities[0]);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    // Edit first item
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    // Modify title
    const titleInput = screen.getByDisplayValue('Community 1');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Community');

    // Submit
    fireEvent.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(adminApi.updateLookupEntry).toHaveBeenCalledWith('communities', 1, {
        title: 'Updated Community',
      });
    });
  });

  it('should delete item when delete button clicked and confirmed', async () => {
    // Mock window.confirm
    const mockConfirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { value: mockConfirm });

    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
    vi.mocked(adminApi.deleteLookupEntry).mockResolvedValue();

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete "Community 1"?');

    await waitFor(() => {
      expect(adminApi.deleteLookupEntry).toHaveBeenCalledWith('communities', 1);
    });
  });

  it('should not delete item when delete is cancelled', async () => {
    // Mock window.confirm to return false
    const mockConfirm = vi.fn().mockReturnValue(false);
    Object.defineProperty(window, 'confirm', { value: mockConfirm });

    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    expect(mockConfirm).toHaveBeenCalled();
    expect(adminApi.deleteLookupEntry).not.toHaveBeenCalled();
  });

  it('should cancel form when cancel button clicked', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add Community'));
    expect(screen.getByText('Add New Community')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add New Community')).not.toBeInTheDocument();
  });

  it('should handle empty items list', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([]);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (0)')).toBeInTheDocument();
      expect(screen.getByText('No communities found. Create your first item to get started.')).toBeInTheDocument();
    });
  });

  it('should disable create button when title is empty', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      expect(screen.getByText('Communities (2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Community'));

    const createButton = screen.getByText('Create');
    expect(createButton).toBeDisabled();
  });

  it('should format dates correctly', async () => {
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

    renderWithProviders(<AdminLookupsPage />);

    await waitFor(() => {
      // Check that dates are formatted (using toLocaleDateString)
      // Each date appears twice per row (Created + Updated columns)
      const expectedDate1 = new Date('2024-01-01T00:00:00Z').toLocaleDateString();
      const expectedDate2 = new Date('2024-01-02T00:00:00Z').toLocaleDateString();

      expect(screen.getAllByText(expectedDate1)).toHaveLength(2);
      expect(screen.getAllByText(expectedDate2)).toHaveLength(2);
    });
  });
});