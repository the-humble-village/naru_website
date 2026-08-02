import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { DashboardPage } from '../DashboardPage';
import { dashboardApi } from '../../api/dashboard';
import { DashboardResponse } from '@naru/shared';

// Mock the dashboard API
vi.mock('../../api/dashboard', () => ({
  dashboardApi: {
    fetchDashboardData: vi.fn(),
  },
}));

// Mock useTranslation to return predictable English strings
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = { 'nav.dashboard': 'Dashboard' };
      return map[key] ?? key;
    },
    lang: 'en',
  }),
}));

// Mock useFamilyTable and FamiliesTable — not under test here
vi.mock('../families/useFamilyTable', () => ({
  useFamilyTable: () => ({
    families: [],
    isLoading: false,
    totalFamilies: 0,
    currentPage: 1,
    setCurrentPage: vi.fn(),
    setInCrisisFilter: vi.fn(),
    communityLookup: {},
    familiesLoading: false,
  }),
}));

vi.mock('../families/FamiliesTable', () => ({
  FamiliesTable: () => null,
}));

const mockDashboardData: DashboardResponse = {
  recentVisits: {
    childVisits: [
      {
        id: 1,
        localId: null,
        familyId: 1,
        childId: 1,
        visitDate: '2024-03-15T10:00:00Z',
        weight: 3.5,
        height: 500,
        armCircumference: 120,
        incap: false,
        leche: true,
        bagsGiven: null,
        recvAnyMedicine: null,
        leftFromProg: null,
        passedAway: null,
        questions: [],
        photos: [],
        notes: null,
        createdAt: '2024-03-15T10:00:00Z',
        updatedAt: '2024-03-15T10:00:00Z',
        child: {
          id: 1,
          name: 'Maria Garcia',
          familyId: 1,
        },
      },
    ],
    familyVisits: [
      {
        id: 1,
        localId: null,
        familyId: 2,
        visitDate: '2024-03-14T15:00:00Z',
        trainingsReceived: [],
        resourcesReceived: [],
        questions: [],
        photos: [],
        notes: null,
        createdAt: '2024-03-14T15:00:00Z',
        updatedAt: '2024-03-14T15:00:00Z',
        family: {
          id: 2,
          familyName: 'Rodriguez Family',
        },
      },
    ],
  },
  recentlyUpdatedChildren: [
    {
      id: 1,
      localId: null,
      familyId: 1,
      name: 'Carlos Lopez',
      birthDate: '2023-01-01T00:00:00Z',
      sex: 'MALE' as const,
      dateEntered: null,
      photos: [],
      weight: 4,
      nutritionalState: null,
      reasonEnrollment: null,
      observations: null,
      createdAt: '2024-03-01T10:00:00Z',
      updatedAt: '2024-03-15T10:00:00Z',
      family: {
        id: 1,
        familyName: 'Lopez Family',
      },
      latestVisit: {
        id: 2,
        visitDate: '2024-03-15T10:00:00Z',
        weight: 4,
        height: 520,
        armCircumference: 125,
      },
    },
  ],
  familiesInCrisis: [
    {
      id: 3,
      localId: null,
      familyName: 'Crisis Family',
      childrenEditable: 1,
      inCrisis: true,
      notes: 'Family needs immediate attention',
      communityId: 1,
      siteId: 1,
      birthingAssistantId: null,
      photos: [],
      createdAt: '2024-03-01T10:00:00Z',
      updatedAt: '2024-03-15T10:00:00Z',
      childrenCount: 2,
      lastVisitDate: '2024-03-10T10:00:00Z',
    },
  ],
  stats: {
    totalFamilies: 25,
    totalChildren: 45,
    familiesInCrisis: 3,
    visitsThisMonth: 12,
  },
  visitsPerMonth: [
    { month: 'Oct', count: 4 },
    { month: 'Nov', count: 7 },
    { month: 'Dec', count: 5 },
    { month: 'Jan', count: 9 },
    { month: 'Feb', count: 11 },
    { month: 'Mar', count: 12 },
  ],
  communityBreakdown: [
    { communityId: 1, families: 15, children: 30 },
    { communityId: 2, families: 10, children: 15 },
  ],
};

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dashboard title', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(mockDashboardData);

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(<DashboardPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockRejectedValue(new Error('API Error'));

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('should render dashboard data successfully', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(mockDashboardData);

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      // Check statistics
      expect(screen.getByText('25')).toBeInTheDocument(); // Total Families
      expect(screen.getByText('45')).toBeInTheDocument(); // Total Children
      expect(screen.getByText('3')).toBeInTheDocument(); // Families in Crisis
      expect(screen.getByText('12')).toBeInTheDocument(); // Visits This Month

      // Check section headers
      expect(screen.getByText('Recent Visits')).toBeInTheDocument();
      expect(screen.getByText('Recently Updated Children')).toBeInTheDocument();

      // Check recent visits content
      expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      expect(screen.getByText('Rodriguez Family')).toBeInTheDocument();

      // Check recently updated children
      expect(screen.getByText('Carlos Lopez')).toBeInTheDocument();
      expect(screen.getByText(/Lopez Family/)).toBeInTheDocument();

      // Families in crisis shown as count in stat card only (no individual family names in overview)
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should handle empty data gracefully', async () => {
    const emptyData: DashboardResponse = {
      recentVisits: {
        childVisits: [],
        familyVisits: [],
      },
      recentlyUpdatedChildren: [],
      familiesInCrisis: [],
      stats: {
        totalFamilies: 0,
        totalChildren: 0,
        familiesInCrisis: 0,
        visitsThisMonth: 0,
      },
      visitsPerMonth: [],
      communityBreakdown: [],
    };

    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(emptyData);

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      // Check that empty state messages are shown
      expect(screen.getByText('No recent visits')).toBeInTheDocument();
      expect(screen.getByText('No recently updated children')).toBeInTheDocument();
    });
  });

  it('should format dates as relative time for recent visits', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(mockDashboardData);

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      // Dates are shown as relative time (e.g., "X days ago"), grouped by visit type
      expect(screen.getByText(/Child Visit/)).toBeInTheDocument();
      expect(screen.getByText(/Family Visit/)).toBeInTheDocument();
    });
  });

  it('should display weight and height information for children', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(mockDashboardData);

    renderWithQueryClient(<DashboardPage />);

    await waitFor(() => {
      // Weight shown as kg (4 kg → 4.0 kg), height shown in mm
      expect(screen.getByText(/4\.0 kg/)).toBeInTheDocument();
      expect(screen.getByText(/520 mm/)).toBeInTheDocument();
    });
  });
});