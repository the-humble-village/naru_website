import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { FamiliesPage } from '../families/FamiliesPage';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import { FamilyListItem, LookupRead } from '@naru/shared';

// Mock the API modules
vi.mock('../../api/families');
vi.mock('../../api/admin');

const mockFamiliesApi = vi.mocked(familiesApi);
const mockAdminApi = vi.mocked(adminApi);

// Test data
const mockCommunities: LookupRead[] = [
  { id: 1, title: 'Community A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Community B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockSites: LookupRead[] = [
  { id: 1, title: 'Site A', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 2, title: 'Site B', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockFamilies: FamilyListItem[] = [
  {
    id: 1,
    localId: null,
    familyName: 'Garcia Family',
    childrenEditable: 1,
    inCrisis: false,
    notes: 'Active family',
    communityId: 1,
    siteId: null,
    birthingAssistantId: null,
    photos: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    lastVisitDate: '2024-01-10T00:00:00Z',
  },
  {
    id: 2,
    localId: null,
    familyName: 'Rodriguez Family',
    childrenEditable: 0,
    inCrisis: true,
    notes: 'Family in crisis',
    communityId: 2,
    siteId: null,
    birthingAssistantId: null,
    photos: [],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-16T00:00:00Z',
    lastVisitDate: null,
  },
];

const mockFamiliesResponse = {
  families: mockFamilies,
  total: 2,
  skip: 0,
  limit: 20,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

// Helper to render component with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('FamiliesPage', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    queryClient.clear();

    // Default mock implementations
    mockAdminApi.fetchCommunities.mockResolvedValue(mockCommunities);
    mockAdminApi.fetchSites.mockResolvedValue(mockSites);
    mockFamiliesApi.listFamilies.mockResolvedValue(mockFamiliesResponse);
  });

  describe('Initial Render', () => {
    it('should render the page title and add family button', async () => {
      renderWithProviders(<FamiliesPage />);

      expect(screen.getByRole('heading', { name: /families/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /add family/i })).toBeInTheDocument();
    });

    it('should render filter controls', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/search families/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/community/i)).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /in crisis/i })).toBeInTheDocument();
      });
    });

    it('should load and display communities in dropdown', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        const communitySelect = screen.getByLabelText(/community/i);
        const options = communitySelect.querySelectorAll('option');
        const optionTexts = Array.from(options).map(option => option.textContent);

        expect(optionTexts).toContain('Community A');
        expect(optionTexts).toContain('Community B');
      });

      expect(mockAdminApi.fetchCommunities).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Loading', () => {
    it('should display loading state initially', () => {
      renderWithProviders(<FamiliesPage />);

      expect(screen.getByText(/loading families/i)).toBeInTheDocument();
    });

    it('should display families data when loaded', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
        expect(screen.getByText('Rodriguez Family')).toBeInTheDocument();
      });

      expect(mockFamiliesApi.listFamilies).toHaveBeenCalledWith({
        search: undefined,
        communityId: undefined,
        inCrisis: undefined,
        skip: 0,
        limit: 20,
      });
    });

    it('should display error state when API fails', async () => {
      mockFamiliesApi.listFamilies.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText(/error loading families/i)).toBeInTheDocument();
        expect(screen.getByText(/api error/i)).toBeInTheDocument();
      });
    });

    it('should display no results message when no families found', async () => {
      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: [],
        total: 0,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText(/no families found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should update search term and trigger new query', async () => {
      renderWithProviders(<FamiliesPage />);

      const searchInput = screen.getByLabelText(/search families/i);

      fireEvent.change(searchInput, { target: { value: 'Garcia' } });

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenCalledWith({
          search: 'Garcia',
          communityId: undefined,
          inCrisis: undefined,
          skip: 0,
          limit: 20,
        });
      });
    });

    it('should reset to first page when searching', async () => {
      renderWithProviders(<FamiliesPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText(/search families/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenLastCalledWith({
          search: 'test',
          communityId: undefined,
          inCrisis: undefined,
          skip: 0,
          limit: 20,
        });
      });
    });
  });

  describe('Community Filter', () => {
    it('should filter by community when selected', async () => {
      renderWithProviders(<FamiliesPage />);

      // Wait for communities to load
      await waitFor(() => {
        const communitySelect = screen.getByLabelText(/community/i);
        expect(communitySelect).toHaveTextContent('Community A');
      });

      const communitySelect = screen.getByLabelText(/community/i);
      fireEvent.change(communitySelect, { target: { value: '1' } });

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenCalledWith({
          search: undefined,
          communityId: 1,
          inCrisis: undefined,
          skip: 0,
          limit: 20,
        });
      });
    });

    it('should clear community filter when "All Communities" selected', async () => {
      renderWithProviders(<FamiliesPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      const communitySelect = screen.getByLabelText(/community/i);

      // First select a community
      fireEvent.change(communitySelect, { target: { value: '1' } });

      // Then clear it
      fireEvent.change(communitySelect, { target: { value: '' } });

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenLastCalledWith({
          search: undefined,
          communityId: undefined,
          inCrisis: undefined,
          skip: 0,
          limit: 20,
        });
      });
    });
  });

  describe('Crisis Status Filter', () => {
    it('should filter to families in crisis when checked', async () => {
      renderWithProviders(<FamiliesPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('checkbox', { name: /in crisis/i }));

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenCalledWith({
          search: undefined,
          communityId: undefined,
          inCrisis: true,
          skip: 0,
          limit: 20,
        });
      });
    });

    it('should drop the crisis filter when unchecked', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      const crisisCheckbox = screen.getByRole('checkbox', { name: /in crisis/i });
      fireEvent.click(crisisCheckbox);
      fireEvent.click(crisisCheckbox);

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenLastCalledWith({
          search: undefined,
          communityId: undefined,
          inCrisis: undefined,
          skip: 0,
          limit: 20,
        });
      });
    });
  });

  describe('Table Display', () => {
    it('should display family data in table format', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        // Check table headers
        expect(screen.getByText('Family Name')).toBeInTheDocument();
        expect(screen.getAllByText('Community')).toHaveLength(2); // One in filter, one in table header
        expect(screen.getAllByText('Crisis Status')).toHaveLength(2); // One in filter, one in table header
        expect(screen.getByText('Last Visited')).toBeInTheDocument();

        // Check family data
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
        expect(screen.getByText('Rodriguez Family')).toBeInTheDocument();

        // Check crisis status badges
        expect(screen.getByText('Stable')).toBeInTheDocument();
        expect(screen.getAllByText('In Crisis')).toHaveLength(2); // One in filter option, one in badge
      });
    });

    it('should display community names from lookup data', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        // Look for community names in the table cells specifically
        const table = screen.getByRole('table');
        expect(table).toHaveTextContent('Community A');
        expect(table).toHaveTextContent('Community B');
      });
    });

    it('should display "None" for families without community', async () => {
      const familyWithoutCommunity: FamilyListItem = {
        ...mockFamilies[0]!,
        communityId: null,
      };

      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: [familyWithoutCommunity],
        total: 1,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        // Community and Site both render "None" for this family
        expect(screen.getAllByText('None').length).toBeGreaterThan(0);
      });
    });

    it('should display "Unnamed Family" for families without name', async () => {
      const unnamedFamily: FamilyListItem = {
        ...mockFamilies[0]!,
        familyName: null,
      };

      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: [unnamedFamily],
        total: 1,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Unnamed Family')).toBeInTheDocument();
      });
    });

    it('should navigate to the family detail page when a row is clicked', async () => {
      window.history.pushState({}, '', '/');
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Garcia Family'));

      await waitFor(() => {
        expect(window.location.pathname).toBe('/families/1');
      });

      window.history.pushState({}, '', '/');
    });
  });

  describe('Pagination', () => {
    it('should show pagination when there are multiple pages', async () => {
      // Mock response with more families than page size
      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: mockFamilies,
        total: 50,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText(/showing/i)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /previous/i })).toHaveLength(2); // Mobile and desktop versions
        expect(screen.getAllByRole('button', { name: /next/i })).toHaveLength(2); // Mobile and desktop versions
      });
    });

    it('should not show pagination when all results fit on one page', async () => {
      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      // Pagination should not be shown for only 2 results
      expect(screen.queryAllByRole('button', { name: /previous/i })).toHaveLength(0);
    });

    it('should navigate to next page when next button clicked', async () => {
      // Mock response with multiple pages
      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: mockFamilies,
        total: 50,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      const nextButtons = screen.getAllByRole('button', { name: /next/i });
      fireEvent.click(nextButtons[0]!); // Click the first next button

      await waitFor(() => {
        expect(mockFamiliesApi.listFamilies).toHaveBeenCalledWith({
          search: undefined,
          communityId: undefined,
          inCrisis: undefined,
          skip: 20,
          limit: 20,
        });
      });
    });

    it('should disable previous button on first page', async () => {
      mockFamiliesApi.listFamilies.mockResolvedValue({
        families: mockFamilies,
        total: 50,
        skip: 0,
        limit: 20,
      });

      renderWithProviders(<FamiliesPage />);

      await waitFor(() => {
        const prevButtons = screen.getAllByRole('button', { name: /previous/i });
        expect(prevButtons[0]).toBeDisabled();
        expect(prevButtons[1]).toBeDisabled();
      });
    });
  });

});