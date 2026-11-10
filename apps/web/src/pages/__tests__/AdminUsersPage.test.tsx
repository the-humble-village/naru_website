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
    checkLoginAvailability: vi.fn(),
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
    vi.mocked(usersApi.checkLoginAvailability).mockResolvedValue({
      available: true,
      deleted: false,
    });
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
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    // Username is on the edit form, not in the table.
    expect(screen.queryByRole('columnheader', { name: 'Username' })).not.toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check user data
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Supervisor')).toBeInTheDocument();
    expect(screen.queryByText('supervisor1')).not.toBeInTheDocument();
    // caseworker1 has no first/last name, so its username stands in as the name
    expect(screen.getAllByText('caseworker1')).toHaveLength(1);

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
    expect(screen.getByLabelText(/Username/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password/)).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/Username/), 'newuser');
    await user.type(screen.getByLabelText(/Email/), 'new@test.com');
    await user.type(screen.getByLabelText(/First Name/), 'New');
    await user.type(screen.getByLabelText(/Last Name/), 'User');
    await user.type(screen.getByLabelText(/^Password/), 'password12345');
    await user.type(screen.getByLabelText(/^Confirm Password/), 'password12345');

    // Submit form
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalledWith(
        {
          login: 'newuser',
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'User',
          password: 'password12345',
          role: 'CASEWORKER', // Default
          lang: 'en', // Default
        },
        expect.anything(),
      );
    });
  });

  it('should trim email and names when creating', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    vi.mocked(usersApi.createUser).mockResolvedValue(mockUsers[0]!);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    await user.type(screen.getByLabelText(/Username/), 'minimal');
    await user.type(screen.getByLabelText(/^Email/), '  minimal@test.com ');
    await user.type(screen.getByLabelText(/First Name/), ' Mini ');
    await user.type(screen.getByLabelText(/Last Name/), ' Mal ');
    await user.type(screen.getByLabelText(/^Password/), 'password12345');
    await user.type(screen.getByLabelText(/^Confirm Password/), 'password12345');
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => {
      expect(usersApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          login: 'minimal',
          email: 'minimal@test.com',
          firstName: 'Mini',
          lastName: 'Mal',
        }),
        expect.anything(),
      );
    });
  });

  // The save button is an onClick rather than a submit, so the input's
  // minLength never fires. Without the schema pre-flight the first sign that a
  // password is too short would be a 400 from the server.
  it('rejects a short password before calling the API', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    await user.type(screen.getByLabelText(/Username/), 'shortpass');
    await user.type(screen.getByLabelText(/^Email/), 'shortpass@test.com');
    await user.type(screen.getByLabelText(/First Name/), 'Short');
    await user.type(screen.getByLabelText(/Last Name/), 'Pass');
    await user.type(screen.getByLabelText(/^Password/), 'eleven-char');
    await user.type(screen.getByLabelText(/^Confirm Password/), 'eleven-char'); // 11
    fireEvent.click(screen.getByText('Create User'));

    // Flagged under the field, not as a "Couldn't create user." banner.
    expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(usersApi.createUser).not.toHaveBeenCalled();
  });

  it('flags a short password as soon as the field is left', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    const password = screen.getByLabelText(/^Password/);
    await user.type(password, 'short');
    expect(screen.queryByText('Password must be at least 12 characters')).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');

    // Clears live once fixed.
    await user.type(password, '-but-now-long');
    expect(screen.queryByText('Password must be at least 12 characters')).not.toBeInTheDocument();
  });

  it('blocks create when the confirm password does not match', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    await user.type(screen.getByLabelText(/Username/), 'typo');
    await user.type(screen.getByLabelText(/^Email/), 'typo@test.com');
    await user.type(screen.getByLabelText(/First Name/), 'Ty');
    await user.type(screen.getByLabelText(/Last Name/), 'Po');
    await user.type(screen.getByLabelText(/^Password/), 'password12345');
    await user.type(screen.getByLabelText(/^Confirm Password/), 'password12346');
    fireEvent.click(screen.getByText('Create User'));

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password/)).toHaveFocus();
    expect(screen.getByLabelText(/^Confirm Password/)).toHaveAttribute('aria-invalid', 'true');
    expect(usersApi.createUser).not.toHaveBeenCalled();
  });

  it('waits for the confirm box to be left before flagging a mismatch', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add User'));
    await user.type(screen.getByLabelText(/^Password/), 'password12345');
    await user.type(screen.getByLabelText(/^Confirm Password/), 'pass');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/^Confirm Password/));
    await user.type(screen.getByLabelText(/^Confirm Password/), 'word12345');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();
  });

  describe('username availability', () => {
    const openCreateForm = async () => {
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (3)')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Add User'));
    };

    it('warns when the username belongs to a listed user', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'admin');
      await user.tab();

      expect(screen.getByText('That username is already taken')).toBeInTheDocument();
      expect(screen.getByLabelText(/Username/)).toHaveAttribute('aria-invalid', 'true');
    });

    it('asks the server, which also knows about deleted users', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.checkLoginAvailability).mockResolvedValue({
        available: false,
        deleted: true,
      });
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'olduser');
      await user.tab();

      expect(
        await screen.findByText("That username belonged to a deleted user and can't be reused")
      ).toBeInTheDocument();
      expect(usersApi.checkLoginAvailability).toHaveBeenCalledWith('olduser', undefined);
    });

    it('blocks create while the username is taken', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'supervisor1');
      await user.type(screen.getByLabelText(/^Email/), 'new@test.com');
      await user.type(screen.getByLabelText(/First Name/), 'New');
      await user.type(screen.getByLabelText(/Last Name/), 'User');
      await user.type(screen.getByLabelText(/^Password/), 'password12345');
      await user.type(screen.getByLabelText(/^Confirm Password/), 'password12345');
      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText('That username is already taken')).toBeInTheDocument();
      expect(screen.getByLabelText(/Username/)).toHaveFocus();
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it("doesn't flag a user's own username when editing them", async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (3)')).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByText('Edit')[1]!);

      await user.click(screen.getByLabelText(/Username/));
      await user.tab();

      expect(screen.queryByText('That username is already taken')).not.toBeInTheDocument();
      expect(usersApi.checkLoginAvailability).not.toHaveBeenCalled();
    });
  });

  describe('sorting', () => {
    // A second caseworker, so sorting by role has a tie to break by name.
    const sortUsers: UserRead[] = [
      ...mockUsers,
      { ...mockUsers[2]!, id: 4, login: 'azed', firstName: 'Ana', lastName: 'Zed' },
    ];

    const renderSorted = async () => {
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(sortUsers);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (4)')).toBeInTheDocument();
      });
    };

    /** Display names down the table, without the "(you)" marker. */
    const rowNames = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          (within(row).getAllByRole('cell')[0]?.textContent ?? '').replace(/\(.*\)/, '').trim()
        );

    it('keeps the server order until a header is clicked', async () => {
      await renderSorted();
      expect(rowNames()).toEqual(['Admin User', 'Jane Supervisor', 'caseworker1', 'Ana Zed']);
      expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveAttribute('aria-sort');
    });

    it('sorts by name, case-insensitively, and reverses on a second click', async () => {
      await renderSorted();

      fireEvent.click(screen.getByRole('button', { name: 'Name' }));
      expect(rowNames()).toEqual(['Admin User', 'Ana Zed', 'caseworker1', 'Jane Supervisor']);
      expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
        'aria-sort',
        'ascending'
      );

      fireEvent.click(screen.getByRole('button', { name: 'Name' }));
      expect(rowNames()).toEqual(['Jane Supervisor', 'caseworker1', 'Ana Zed', 'Admin User']);
      expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
        'aria-sort',
        'descending'
      );
    });

    it('sorts by role hierarchy, keeping names alphabetical within a role', async () => {
      await renderSorted();

      fireEvent.click(screen.getByRole('button', { name: 'Role' }));
      expect(rowNames()).toEqual(['Admin User', 'Jane Supervisor', 'Ana Zed', 'caseworker1']);

      fireEvent.click(screen.getByRole('button', { name: 'Role' }));
      expect(rowNames()).toEqual(['Ana Zed', 'caseworker1', 'Jane Supervisor', 'Admin User']);
    });

    it('switching columns starts the new column ascending', async () => {
      await renderSorted();

      fireEvent.click(screen.getByRole('button', { name: 'Name' }));
      fireEvent.click(screen.getByRole('button', { name: 'Name' }));
      fireEvent.click(screen.getByRole('button', { name: 'Role' }));

      expect(screen.getByRole('columnheader', { name: 'Role' })).toHaveAttribute(
        'aria-sort',
        'ascending'
      );
      expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveAttribute('aria-sort');
    });
  });

  it('shows placeholders on the create form', async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Add User'));

    expect(screen.getByLabelText(/Username/)).toHaveAttribute('placeholder', 'e.g. mlopez');
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('placeholder', 'name@example.com');
    expect(screen.getByLabelText(/First Name/)).toHaveAttribute('placeholder', 'e.g. María');
    expect(screen.getByLabelText(/Last Name/)).toHaveAttribute('placeholder', 'e.g. López');
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute('placeholder', 'At least 12 characters');
  });

  describe('email validation', () => {
    const openCreateForm = async () => {
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (3)')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Add User'));
      return screen.getByLabelText(/^Email/);
    };

    const invalidMessage = /Enter a valid email address/;

    it('stays quiet while the address is still being typed', async () => {
      const user = userEvent.setup();
      const email = await openCreateForm();

      await user.type(email, 'not-an-email');

      expect(screen.queryByText(invalidMessage)).not.toBeInTheDocument();
      expect(email).not.toHaveAttribute('aria-invalid');
    });

    it('flags a malformed address when the field is left', async () => {
      const user = userEvent.setup();
      const email = await openCreateForm();

      await user.type(email, 'not-an-email');
      await user.tab();

      expect(screen.getByText(invalidMessage)).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveAttribute('aria-describedby', 'user-email-error');
    });

    it('clears the error as soon as the address is fixed', async () => {
      const user = userEvent.setup();
      const email = await openCreateForm();

      await user.type(email, 'name');
      await user.tab();
      expect(screen.getByText(invalidMessage)).toBeInTheDocument();

      await user.type(email, '@example.com');
      expect(screen.queryByText(invalidMessage)).not.toBeInTheDocument();
    });

    const requiredMessage = 'Enter an email address';

    it('marks email as required on the create form', async () => {
      const email = await openCreateForm();
      expect(email).toBeRequired();
      expect(screen.getByText('Email', { selector: 'label' })).toHaveTextContent('Email *');
    });

    it('flags a blank email when the field is left', async () => {
      const user = userEvent.setup();
      const email = await openCreateForm();

      await user.click(email);
      await user.tab();

      expect(screen.getByText(requiredMessage)).toBeInTheDocument();
      expect(email).toHaveAttribute('aria-invalid', 'true');
    });

    it('blocks create when email is left blank', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'newuser');
      await user.type(screen.getByLabelText(/^Password/), 'long-enough-password');
      await user.type(screen.getByLabelText(/^Confirm Password/), 'long-enough-password');
      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText(requiredMessage)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Email/)).toHaveFocus();
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('treats a whitespace-only email as blank', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'newuser');
      await user.type(screen.getByLabelText(/^Email/), '   ');
      await user.type(screen.getByLabelText(/^Password/), 'long-enough-password');
      await user.type(screen.getByLabelText(/^Confirm Password/), 'long-enough-password');
      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText(requiredMessage)).toBeInTheDocument();
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    const openEditFor = async (index: number) => {
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
      vi.mocked(usersApi.updateUser).mockResolvedValue(mockUsers[index]!);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (3)')).toBeInTheDocument();
      });
      fireEvent.click(screen.getAllByText('Edit')[index]!);
      return screen.getByLabelText(/^Email/);
    };

    it('will not let an existing email be cleared', async () => {
      const user = userEvent.setup();
      const email = await openEditFor(1); // supervisor@test.com

      await user.clear(email);
      fireEvent.click(screen.getByText('Update User'));

      expect(screen.getByText(requiredMessage)).toBeInTheDocument();
      expect(usersApi.updateUser).not.toHaveBeenCalled();
    });

    it('marks first and last name as required on the create form', async () => {
      await openCreateForm();
      expect(screen.getByLabelText(/First Name/)).toBeRequired();
      expect(screen.getByLabelText(/Last Name/)).toBeRequired();
    });

    it('flags blank names and blocks create, focusing the first one', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'newuser');
      await user.type(screen.getByLabelText(/^Email/), 'new@test.com');
      await user.type(screen.getByLabelText(/Last Name/), '   ');
      await user.type(screen.getByLabelText(/^Password/), 'long-enough-password');
      await user.type(screen.getByLabelText(/^Confirm Password/), 'long-enough-password');
      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText('Enter a first name')).toBeInTheDocument();
      expect(screen.getByText('Enter a last name')).toBeInTheDocument();
      expect(screen.getByLabelText(/First Name/)).toHaveFocus();
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('clears a name error as soon as the name is typed', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.click(screen.getByLabelText(/First Name/));
      await user.tab();
      expect(screen.getByText('Enter a first name')).toBeInTheDocument();

      await user.type(screen.getByLabelText(/First Name/), 'Ana');
      expect(screen.queryByText('Enter a first name')).not.toBeInTheDocument();
    });

    it('will not let an existing name be cleared', async () => {
      const user = userEvent.setup();
      await openEditFor(1); // Jane Supervisor

      await user.clear(screen.getByLabelText(/Last Name/));
      fireEvent.click(screen.getByText('Update User'));

      expect(screen.getByText('Enter a last name')).toBeInTheDocument();
      expect(usersApi.updateUser).not.toHaveBeenCalled();
    });

    it('still lets a user created without an email be edited', async () => {
      const email = await openEditFor(2); // caseworker1: no email, no names
      expect(email).not.toBeRequired();
      expect(screen.getByLabelText(/First Name/)).not.toBeRequired();
      expect(screen.getByLabelText(/Last Name/)).not.toBeRequired();

      fireEvent.change(screen.getByLabelText(/Role/), { target: { value: 'SUPERVISOR' } });
      fireEvent.click(screen.getByText('Update User'));

      await waitFor(() => {
        expect(usersApi.updateUser).toHaveBeenCalledWith(mockUsers[2]!.id, { role: 'SUPERVISOR' });
      });
      expect(screen.queryByText(requiredMessage)).not.toBeInTheDocument();
    });

    it('blocks create with an inline error instead of the banner', async () => {
      const user = userEvent.setup();
      await openCreateForm();

      await user.type(screen.getByLabelText(/Username/), 'newuser');
      await user.type(screen.getByLabelText(/^Email/), 'bad@');
      await user.type(screen.getByLabelText(/^Password/), 'long-enough-password');
      await user.type(screen.getByLabelText(/^Confirm Password/), 'long-enough-password');
      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText(invalidMessage)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Email/)).toHaveFocus();
      expect(usersApi.createUser).not.toHaveBeenCalled();
    });

    it('blocks update when the email is edited into a bad one', async () => {
      const user = userEvent.setup();
      vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);
      renderWithProviders(<AdminUsersPage />);
      await waitFor(() => {
        expect(screen.getByText('Users (3)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText('Edit')[1]!);
      const email = screen.getByLabelText(/^Email/);
      await user.clear(email);
      await user.type(email, 'supervisor@');
      fireEvent.click(screen.getByText('Update User'));

      expect(screen.getByText(invalidMessage)).toBeInTheDocument();
      expect(usersApi.updateUser).not.toHaveBeenCalled();
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
    expect(screen.getByLabelText(/Username/)).toHaveValue('admin');
    expect(screen.getByLabelText(/Email/)).toHaveValue('admin@test.com');
    expect(screen.getByLabelText(/First Name/)).toHaveValue('Admin');
    expect(screen.getByLabelText(/Last Name/)).toHaveValue('User');

    // Password field is now shown for edits (blank = keep current password)
    expect(screen.getByLabelText(/^New Password/)).toHaveValue('');
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

    await user.clear(screen.getByLabelText(/Username/));
    await user.type(screen.getByLabelText(/Username/), 'supervisor2');
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

    await user.type(screen.getByLabelText(/^New Password/), 'brandnewpass');
    await user.type(screen.getByLabelText(/^Confirm New Password/), 'brandnewpass');
    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(usersApi.resetUserPassword).toHaveBeenCalledWith(2, { password: 'brandnewpass' });
    });
    // No other field changed, so no update call was made
    expect(usersApi.updateUser).not.toHaveBeenCalled();
  });

  it('does not reset the password when the confirm box does not match', async () => {
    const user = userEvent.setup();
    vi.mocked(usersApi.fetchUsers).mockResolvedValue(mockUsers);

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!);

    await user.type(screen.getByLabelText(/^New Password/), 'brandnewpass');
    fireEvent.click(screen.getByText('Update User'));

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(usersApi.resetUserPassword).not.toHaveBeenCalled();
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
      apiError('A user with this username already exists')
    );

    renderWithProviders(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Users (3)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Edit')[1]!);
    await user.clear(screen.getByLabelText(/Username/));
    // Not in the loaded list, so only the server can reject it (a race, or a
    // deleted user the list can't see).
    await user.type(screen.getByLabelText(/Username/), 'ghost');
    fireEvent.click(screen.getByText('Update User'));

    await waitFor(() => {
      expect(
        screen.getByText("Couldn't update user. A user with this username already exists")
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

      // User with no names shows their username as the display name
      expect(screen.getAllByText('caseworker1')).toHaveLength(1);
    });
  });
});
