import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ChildDetailPage from '../children/ChildDetailPage';
import * as childrenApi from '../../api/children';
import * as visitsApi from '../../api/visits';

// Mock the API modules
vi.mock('../../api/children', () => ({
  childrenApi: {
    fetchChild: vi.fn(),
  },
}));

vi.mock('../../api/visits', () => ({
  visitsApi: {
    listChildVisits: vi.fn(),
  },
}));

// Mock useParams to return specific values
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(),
  };
});

const mockFetchChild = childrenApi.childrenApi.fetchChild as ReturnType<typeof vi.fn>;
const mockListChildVisits = visitsApi.visitsApi.listChildVisits as ReturnType<typeof vi.fn>;

// Test utilities
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
};

const mockChild = {
  id: 2,
  localId: null,
  familyId: 1,
  name: 'Maria Garcia',
  birthDate: '2023-01-15T00:00:00.000Z',
  sex: 'FEMALE' as const,
  dateEntered: '2023-02-01T00:00:00.000Z',
  photos: [],
  weight: 12500, // 12.5 kg in grams
  nutritionalState: 'Good',
  reasonEnrollment: 'Regular checkup',
  observations: 'Healthy development',
  createdAt: '2023-01-15T10:00:00.000Z',
  updatedAt: '2023-03-15T10:00:00.000Z',
  zScores: {
    weightForAge: {
      zScore: -0.5,
      classification: 'normal',
    },
    ageInDays: 400,
  },
};

const mockVisitsResponse = {
  visits: [
    {
      id: 1,
      localId: null,
      familyId: 1,
      childId: 2,
      visitDate: '2023-03-01T10:00:00.000Z',
      weight: 12000,
      armCircumference: 165, // 16.5 cm in mm
      height: 850, // 85 cm in mm
      incap: false,
      leche: true,
      bagsGiven: null,
      recvAnyMedicine: null,
      leftFromProg: null,
      passedAway: null,
      questions: [],
      notes: 'Normal development',
      createdAt: '2023-03-01T10:00:00.000Z',
      updatedAt: '2023-03-01T10:00:00.000Z',
    },
    {
      id: 2,
      localId: null,
      familyId: 1,
      childId: 2,
      visitDate: '2023-02-01T10:00:00.000Z',
      weight: 11000,
      armCircumference: 160,
      height: 820,
      incap: false,
      leche: false,
      bagsGiven: null,
      recvAnyMedicine: null,
      leftFromProg: null,
      passedAway: null,
      questions: [],
      notes: null,
      createdAt: '2023-02-01T10:00:00.000Z',
      updatedAt: '2023-02-01T10:00:00.000Z',
    },
  ],
  total: 2,
  skip: 0,
  limit: 10,
};

describe('ChildDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Mock useParams to return expected route parameters
    const { useParams } = await import('react-router-dom');
    (useParams as any).mockReturnValue({ id: '1', cid: '2' });
  });

  describe('Loading states', () => {
    it('should show loading state while fetching child data', () => {
      mockFetchChild.mockReturnValue(new Promise(() => {})); // Never resolves
      mockListChildVisits.mockReturnValue(new Promise(() => {}));

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Child information display', () => {
    it('should render child details successfully', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      expect(screen.getByText('12.50 kg')).toBeInTheDocument();
      expect(screen.getByText(/Female/)).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      expect(screen.getByText('Regular checkup')).toBeInTheDocument();
      expect(screen.getByText('Healthy development')).toBeInTheDocument();
    });

    it('should format dates correctly', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      // Birth date should be formatted
      expect(screen.getByText(/1\/15\/2023/)).toBeInTheDocument();
      // Date entered should be formatted (using selector to avoid collision with visit table)
      expect(screen.getByText(/2\/1\/2023/, { selector: 'div' })).toBeInTheDocument();
    });

    it('should calculate age correctly', async () => {
      const childWithAge = {
        ...mockChild,
        birthDate: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 18 months ago
      };

      mockFetchChild.mockResolvedValue(childWithAge);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      // Should show age in years and months
      expect(screen.getByText(/1 yr \d+ mo/)).toBeInTheDocument();
    });

    it('should handle optional fields gracefully', async () => {
      const minimalChild = {
        id: 2,
        localId: null,
        familyId: 1,
        name: 'Simple Child',
        birthDate: '2023-01-15T00:00:00.000Z',
        sex: 'MALE' as const,
        dateEntered: null,
        photos: [],
        weight: 10000,
        nutritionalState: null,
        reasonEnrollment: null,
        observations: null,
        createdAt: '2023-01-15T10:00:00.000Z',
        updatedAt: '2023-03-15T10:00:00.000Z',
        zScores: null,
      };

      mockFetchChild.mockResolvedValue(minimalChild);
      mockListChildVisits.mockResolvedValue({ visits: [], total: 0, skip: 0, limit: 10 });

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Simple Child' })).toBeInTheDocument();
      });

      expect(screen.getByText(/Male/)).toBeInTheDocument();
      expect(screen.getByText('10.00 kg')).toBeInTheDocument();
      // Component always renders these labels, showing '—' when null
      expect(screen.getByText('Date Entered')).toBeInTheDocument();
      expect(screen.getByText('Nutritional State')).toBeInTheDocument();
    });
  });

  describe('Z-Score information', () => {
    it('should display z-score badge when data is available', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      expect(screen.getByText(/Weight-for-Age: Normal/)).toBeInTheDocument();
      expect(screen.getByText(/\(-0\.50\)/)).toBeInTheDocument();
      expect(screen.getByText('400 days old')).toBeInTheDocument();
    });

    it('should show no data message when z-scores are unavailable', async () => {
      const childWithoutZScores = { ...mockChild, zScores: null };
      mockFetchChild.mockResolvedValue(childWithoutZScores);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      // When z-scores are null the z-score row is not rendered
      expect(screen.queryByText(/Weight-for-Age/)).not.toBeInTheDocument();
    });
  });

  describe('Visit history', () => {
    it('should display visit history table with data', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      // Check table headers (multiple 'Weight (kg)' exist — chart label + table header)
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getAllByText('Weight (kg)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('MUAC (cm)').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Height (cm)').length).toBeGreaterThanOrEqual(1);

      // Check visit data (converted from grams/mm to kg/cm)
      expect(screen.getByText('12.00')).toBeInTheDocument(); // weight
      expect(screen.getByText('16.5')).toBeInTheDocument(); // arm circumference
      expect(screen.getByText('85.0')).toBeInTheDocument(); // height
      expect(screen.getByText('Normal development')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument(); // empty notes
    });

    it('should show empty state when no visits exist', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue({ visits: [], total: 0, skip: 0, limit: 10 });

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      expect(screen.getByText('No visits recorded yet')).toBeInTheDocument();
    });

    it('should show loading state for visits', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      expect(screen.getByText('Loading visits...')).toBeInTheDocument();
    });

    it('should show error state for visits', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockRejectedValue(new Error('Failed to load visits'));

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      expect(screen.getByText('Error loading visits')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should show error state when child fetch fails', async () => {
      mockFetchChild.mockRejectedValue(new Error('Child not found'));
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Child not found')).toBeInTheDocument();
      });
    });

    it('should show not found state when child is null', async () => {
      mockFetchChild.mockResolvedValue(null);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByText('Child not found')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation links', () => {
    it('should have correct navigation links', async () => {
      mockFetchChild.mockResolvedValue(mockChild);
      mockListChildVisits.mockResolvedValue(mockVisitsResponse);

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Maria Garcia' })).toBeInTheDocument();
      });

      const backLink = screen.getByText('← Back to Family');
      expect(backLink.closest('a')).toHaveAttribute('href', '/families/1');

      const addVisitLink = screen.getByText('Add Visit');
      expect(addVisitLink.closest('a')).toHaveAttribute('href', '/families/1/children/2/visits/new');
    });
  });

  describe('Data formatting', () => {
    it('should handle invalid route parameters gracefully', async () => {
      // Mock useParams to return invalid parameters
      const { useParams } = await import('react-router-dom');
      (useParams as any).mockReturnValue({ id: 'invalid', cid: 'invalid' });

      render(<ChildDetailPage />, { wrapper: createTestWrapper() });

      // Should show not found state and not make API calls with invalid parameters
      expect(screen.getByText('Child not found')).toBeInTheDocument();
      expect(mockFetchChild).not.toHaveBeenCalled();
      expect(mockListChildVisits).not.toHaveBeenCalled();
    });
  });
});