import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminLookupsPage } from '../admin/AdminLookupsPage';
import { adminApi, type LookupEntry } from '../../api/admin';

// Mock the admin API
vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchLookupTable: vi.fn(),
    createLookupEntry: vi.fn(),
    updateLookupEntry: vi.fn(),
    deleteLookupEntry: vi.fn(),
    reorderLookupEntries: vi.fn(),
    fetchSites: vi.fn(),
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

const community1: LookupEntry = {
  id: 1,
  title: 'Community 1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockCommunities: LookupEntry[] = [
  community1,
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

/** The table and the card fallback both render; scope lookups to the table. */
const rowFor = (title: string): HTMLElement => {
  const table = screen.getByRole('table');
  const row = within(table).getByText(title).closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

/** Click the Delete button on the table row whose title cell matches. */
const clickRowDelete = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(within(rowFor(title)).getByRole('button', { name: 'Delete' }));
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
    });
  });

  it('should let an admin edit the title of an existing row', async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
    vi.mocked(adminApi.updateLookupEntry).mockResolvedValue({ ...community1, title: 'Renamed' });

    renderWithProviders(<AdminLookupsPage />);
    await screen.findAllByText('Community 1');

    await user.click(within(rowFor('Community 1')).getByRole('button', { name: 'Edit' }));

    const input = screen.getByLabelText(/Title/);
    expect(input).toHaveValue('Community 1');
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(adminApi.updateLookupEntry).toHaveBeenCalledWith('communities', 1, {
        title: 'Renamed',
        siteId: null,
      });
    });
  });

  describe('delete confirmation', () => {
    it('opens the ConfirmDialog instead of window.confirm', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

      renderWithProviders(<AdminLookupsPage />);
      await screen.findAllByText('Community 1');

      await clickRowDelete(user, 'Community 1');

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Delete Community')).toBeInTheDocument();
      expect(within(dialog).getByText(/Community 1/)).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(adminApi.deleteLookupEntry).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('warns that existing records keep their value but still allows the delete', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

      renderWithProviders(<AdminLookupsPage />);
      await screen.findAllByText('Community 1');
      await clickRowDelete(user, 'Community 1');

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText(/Existing records that already reference this community keep their current value/i)
      ).toBeInTheDocument();
      // The warning must not block: the confirm button stays enabled.
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    it('deletes the row when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
      vi.mocked(adminApi.deleteLookupEntry).mockResolvedValue(undefined);

      renderWithProviders(<AdminLookupsPage />);
      await screen.findAllByText('Community 2');
      await clickRowDelete(user, 'Community 2');

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(adminApi.deleteLookupEntry).toHaveBeenCalledWith('communities', 2);
      });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('does not delete when cancelled', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);

      renderWithProviders(<AdminLookupsPage />);
      await screen.findAllByText('Community 1');
      await clickRowDelete(user, 'Community 1');

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(adminApi.deleteLookupEntry).not.toHaveBeenCalled();
    });

    it('keeps the dialog open and surfaces the error when the delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
      vi.mocked(adminApi.deleteLookupEntry).mockRejectedValue(new Error('Boom'));

      renderWithProviders(<AdminLookupsPage />);
      await screen.findAllByText('Community 1');
      await clickRowDelete(user, 'Community 1');

      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText(/Failed to delete item: Boom/)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('sortable tables', () => {
    it('exposes reorder controls so sortOrder is editable', async () => {
      const user = userEvent.setup();
      mockUseParams.mockReturnValue({ table: 'examination-types' });
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([
        { id: 10, title: 'Exam A', sortOrder: 0, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 11, title: 'Exam B', sortOrder: 1, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      ]);
      vi.mocked(adminApi.reorderLookupEntries).mockResolvedValue(undefined);

      renderWithProviders(<AdminLookupsPage />, ['/admin/examination-types']);
      await screen.findAllByText('Exam A');

      await user.click(within(rowFor('Exam B')).getByRole('button', { name: 'Move up' }));
      await user.click(screen.getByRole('button', { name: /Save Order/ }));

      await waitFor(() => {
        expect(adminApi.reorderLookupEntries).toHaveBeenCalledWith('examination-types', [
          { id: 11, sortOrder: 0 },
          { id: 10, sortOrder: 1 },
        ]);
      });
    });
  });

  describe('communities gain a site column', () => {
    const sites: LookupEntry[] = [
      { id: 7, title: 'Clinic Alpha', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    ];

    beforeEach(() => {
      vi.mocked(adminApi.fetchSites).mockResolvedValue(sites);
    });

    it('shows each community site and warns about the ones with none', async () => {
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([
        { ...community1, siteId: 7 },
        { ...(mockCommunities[1] as LookupEntry), siteId: null },
      ]);

      renderWithProviders(<AdminLookupsPage />);

      const table = await screen.findByRole('table');
      expect(within(rowFor('Community 1')).getByText('Clinic Alpha')).toBeInTheDocument();
      expect(within(table).getAllByText('admin.community_no_site').length).toBeGreaterThan(0);
      expect(screen.getByText('admin.communities_missing_site')).toBeInTheDocument();
    });

    it('hides the banner once every community has a site', async () => {
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([
        { ...community1, siteId: 7 },
        { ...(mockCommunities[1] as LookupEntry), siteId: 7 },
      ]);

      renderWithProviders(<AdminLookupsPage />);
      await screen.findByRole('table');

      expect(screen.queryByText('admin.communities_missing_site')).not.toBeInTheDocument();
    });

    it('sends the selected site when creating a community', async () => {
      const user = userEvent.setup();
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue(mockCommunities);
      vi.mocked(adminApi.createLookupEntry).mockResolvedValue({ ...community1, siteId: 7 });

      renderWithProviders(<AdminLookupsPage />);
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: /Add/ }));
      await user.type(screen.getByLabelText(/Title/), 'Chisec');
      await user.selectOptions(screen.getByLabelText('Site'), '7');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(adminApi.createLookupEntry).toHaveBeenCalledWith('communities', {
          title: 'Chisec',
          siteId: 7,
        });
      });
    });
  });

  describe('resources gain a default unit column', () => {
    it('renders the unit and sends it on create', async () => {
      const user = userEvent.setup();
      mockUseParams.mockReturnValue({ table: 'resources' });
      vi.mocked(adminApi.fetchLookupTable).mockResolvedValue([
        { id: 30, title: 'Chickens', defaultUnit: 'birds', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      ]);
      vi.mocked(adminApi.createLookupEntry).mockResolvedValue({
        id: 31,
        title: 'Seeds',
        defaultUnit: 'kg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      });

      renderWithProviders(<AdminLookupsPage />, ['/admin/resources']);
      await screen.findByRole('table');
      expect(within(rowFor('Chickens')).getByText('birds')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Add/ }));
      await user.type(screen.getByLabelText(/Title/), 'Seeds');
      await user.type(screen.getByLabelText('admin.resource_default_unit'), 'kg');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(adminApi.createLookupEntry).toHaveBeenCalledWith('resources', {
          title: 'Seeds',
          defaultUnit: 'kg',
        });
      });
    });
  });
});
