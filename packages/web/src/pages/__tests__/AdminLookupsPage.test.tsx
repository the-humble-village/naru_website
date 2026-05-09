import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
    });
  });
});
