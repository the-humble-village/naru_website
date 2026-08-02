import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminUsersPage } from '../admin/AdminUsersPage';
import { usersApi } from '../../api/users';
import { UserRead } from '@naru/shared';

// Mock the users API
vi.mock('../../api/users', () => ({
  usersApi: {
    fetchUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

// Mock the auth store — the signed-in admin is user id 1 ("admin"), which is
// also the first row of the table, so the self-protection guards are exercised.
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

/** Build a rejection that looks like an axios error carrying the API body. */
const apiError = (message: string) =>
  Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    response: { data: { error: message } },
  });

const mockUsers: UserRead[] = [
  {
    id: 1,
    localId: null,
    login: 'admin',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
    lang: 'en',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    localId: null,
    login: 'supervisor1',
    email: 'supervisor@test.com',
    firstName: 'Jane',
    lastName: 'Supervisor',
    role: 'SUPERVISOR',
    lang: 'en',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    localId: null,
    login: 'caseworker1',
    email: null,
    firstName: null,
    lastName: null,
    role: 'CASEWORKER',
    lang: 'es',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
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

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title and back link', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to Admin' })).toHaveAttribute('href', '/admin');
  });

  it('should show loading state', () => {
    vi.mocked(usersApi.fetchUsers).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<AdminUsersPage />);

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    vi.mocked(usersApi.fetchUsers).mockRejectedValue(new Error('API Error'));

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load users: API Error')).toBeInTheDocument();
    });
  });

  it('should display users table with correct data', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check user data
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();
    expect(screen.getByText('supervisor1')).toBeInTheDocument();
    // caseworker1 appears twice: once as display name (no first/last), once as login
    expect(screen.getAllByText('caseworker1')).toHaveLength(2);

    // Check role badges
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Supervisor')).toBeInTheDocument();
    expect(screen.getByText('Caseworker')).toBeInTheDocument();

    // Check languages
    expect(screen.getAllByText('English')).toHaveLength(2);
    expect(screen.getByText('Spanish')).toBeInTheDocument();

    // Check row actions
    expect(screen.getAllByText('Edit')).toHaveLength(3);
    expect(getRowDeleteButtons()).toHaveLength(3);

    // The signed-in admin's own row is marked
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('should show add user form when add button clicked', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add User');
    fireEvent.click(addButton);

    expect(screen.getByText('Create New User')).toBeInTheDocument();
    expect(screen.getByLabelText(/Login/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Role/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Language/)).toBeInTheDocument();
  });

  it('should create new user successfully', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.createUser).mockResolvedValue(mockUsers[0]!);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add User'));

    // Fill form
    await user.type(screen.getByLabelText(/Login/), 'newuser');
    await user.type(screen.getByLabelText(/Email/), 'new@test.com');
    await user.type(screen.getByLabelText(/First Name/), 'New');
    await user.type(screen.getByLabelText(/Last Name/), 'User');
    await user.type(screen.getByLabelText(/Password/), 'password123');

    // Submit form
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalledWith(
        {
          login: 'newuser',
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'User',
          password: 'password123',
          role: 'CASEWORKER', // Default
          lang: 'en', // Default
        },
        expect.anything(),
      );
    });
  });

  it('should send blank optional fields as null when creating', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.createUser).mockResolvedValue(mockUsers[0]!);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    await user.type(screen.getByLabelText(/Login/), 'minimal');
    await user.type(screen.getByLabelText(/Password/), 'password123');
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          login: 'minimal',
          email: null,
          firstName: null,
          lastName: null,
        }),
        expect.anything(),
      );
    });
  });

  it('should show edit form when edit button clicked', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]!); // Click first edit button

    expect(screen.getByText('Edit User')).toBeInTheDocument();
    // Use getByLabelText to target form inputs specifically, avoiding
    // duplicates between form display values and role select option text
    expect(screen.getByLabelText(/Login/)).toHaveValue('admin');
    expect(screen.getByLabelText(/Email/)).toHaveValue('admin@test.com');
    expect(screen.getByLabelText(/First Name/)).toHaveValue('Admin');
    expect(screen.getByLabelText(/Last Name/)).toHaveValue('User');

    // Password field is now shown for edits (blank = keep current password)
    expect(screen.getByLabelText(/New Password/)).toHaveValue('');
  });

  it('should update every editable field including role', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.updateUser).mockResolvedValue(mockUsers[1]!);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // Edit the supervisor (not the signed-in user)
    fireEvent.click(screen.getAllByText('Edit')[1]!);

    await user.clear(screen.getByLabelText(/Login/));
    await user.type(screen.getByLabelText(/Login/), 'supervisor2');
    await user.clear(screen.getByLabelText(/First Name/));
    await user.type(screen.getByLabelText(/First Name/), 'Janet');
    fireEvent.change(screen.getByLabelText(/Role/), { target: { value: 'ADMIN' } });
    fireEvent.change(screen.getByLabelText(/Language/), { target: { value: 'es' } });

    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(usersApi.updateUser).toHaveBeenCalledWith(2, {
        login: 'supervisor2',
        firstName: 'Janet',
        role: 'ADMIN',
        lang: 'es',
      });
    });
  });

  it('should reset the password through the dedicated endpoint', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.resetUserPassword).mockResolvedValue(mockUsers[1]!);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!);

    await user.type(screen.getByLabelText(/New Password/), 'brandnewpass');
    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(usersApi.resetUserPassword).toHaveBeenCalledWith(2, { password: 'brandnewpass' });
    });
    // No other field changed, so no update call was made
    expect(usersApi.updateUser).not.toHaveBeenCalled();
  });

  it('should lock the role select when an admin edits their own account', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // Edit self (row 0 is the signed-in admin)
    fireEvent.click(screen.getAllByText('Edit')[0]!);

    const roleSelect = screen.getByLabelText(/Role/);
    expect(roleSelect).toBeDisabled();
    expect(roleSelect).toHaveAttribute(
      'title',
      'You cannot change your own admin role. Ask another admin to do it.'
    );
  });

  it('should leave the role select enabled when editing another user', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!);

    expect(screen.getByLabelText(/Role/)).toBeEnabled();
  });

  it('should disable delete for the signed-in user with an explanatory title', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    const deleteButtons = getRowDeleteButtons();
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toHaveAttribute('title', 'You cannot delete your own account');
    expect(deleteButtons[1]).toBeEnabled();
  });

  it('should delete a user through the confirm dialog', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.deleteUser).mockResolvedValue(undefined);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // No dialog before clicking
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(getRowDeleteButtons()[1]!); // Jane Supervisor

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete user')).toBeInTheDocument();
    expect(within(dialog).getByText(/Jane Supervisor/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(usersApi.deleteUser).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not delete when the confirm dialog is cancelled', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.deleteUser).mockResolvedValue(undefined);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[2]!);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(usersApi.deleteUser).not.toHaveBeenCalled();
  });

  it('should never call window.confirm', async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', {
      value: confirmSpy,
      writable: true,
      configurable: true,
    });

    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.deleteUser).mockResolvedValue(undefined);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[1]!);
    await screen.findByRole('dialog');

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('should surface the server message when a delete is rejected', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.deleteUser).mockRejectedValue(
      apiError('Cannot delete the last remaining admin')
    );

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(getRowDeleteButtons()[1]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete the last remaining admin')).toBeInTheDocument();
    });
    // Dialog stays open so the reason remains visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should surface the server message when an update is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.updateUser).mockRejectedValue(
      apiError('A user with this login already exists')
    );

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!);
    await user.clear(screen.getByLabelText(/Login/));
    await user.type(screen.getByLabelText(/Login/), 'admin');
    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(
        screen.getByText('Failed to update user: A user with this login already exists')
      ).toBeInTheDocument();
    });
    // The form stays open on failure
    expect(screen.getByText('Edit User')).toBeInTheDocument();
  });

  it('should cancel form when cancel button clicked', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('Add User'));
    expect(screen.getByText('Create New User')).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
  });

  it('should handle empty users list', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue([]);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (0)')).toBeInTheDocument();
      expect(screen.getByText('No users found. Create your first user to get started.')).toBeInTheDocument();
    });
  });

  it('should format user names correctly', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      // User with both names shows "First Last"
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();

      // User with no names shows login as display name (also appears in Login column)
      expect(screen.getAllByText('caseworker1')).toHaveLength(2);
    });
  });
});
