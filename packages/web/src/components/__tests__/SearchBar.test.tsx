import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { searchApi } from '../../api/search';
import SearchBar from '../SearchBar';

// Mock the auth store
vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn()
}));

// Mock the search API
vi.mock('../../api/search', () => ({
  searchApi: {
    searchByName: vi.fn()
  }
}));

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock translation hook
vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      const translations: Record<string, string> = {
        'search.placeholder': 'Search families, parents, children...',
        'search.searching': 'Searching',
        'search.error': 'Search failed. Please try again.',
        'search.noResults': 'No results found.',
        'search.types.family': 'Family',
        'search.types.parent': 'Parent',
        'search.types.child': 'Child',
        'search.familyLabel': 'Family',
        'search.showingResults': `Showing ${params?.shown || 0} of ${params?.total || 0} results`,
        'common.unnamed': 'Unnamed',
      };
      return translations[key] || key;
    }
  })
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('SearchBar', () => {
  let mockAuthStore: any;
  let mockSearchApi: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthStore = {
      user: { id: 1, role: 'CASEWORKER', lang: 'en' },
      isAuthenticated: true
    };
    (useAuthStore as Mock).mockReturnValue(mockAuthStore);

    mockSearchApi = searchApi.searchByName as Mock;
    mockSearchApi.mockResolvedValue({
      results: [],
      total: 0,
      query: ''
    });

    mockNavigate.mockClear();
  });

  describe('Basic Rendering', () => {
    it('should render search input with placeholder', () => {
      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText('Search families, parents, children...');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render with custom placeholder', () => {
      render(
        <TestWrapper>
          <SearchBar placeholder="Custom placeholder" />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <TestWrapper>
          <SearchBar className="custom-class" />
        </TestWrapper>
      );

      const container = screen.getByRole('textbox').closest('.custom-class');
      expect(container).toBeInTheDocument();
    });

    it('should render search icon', () => {
      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const searchIcon = screen.getByRole('textbox').parentElement?.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should update input value on typing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should not trigger search for queries less than 2 characters', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'a');

      expect(mockSearchApi).not.toHaveBeenCalled();
    });

    it('should trigger search for queries with 2 or more characters', async () => {
      const user = userEvent.setup();
      mockSearchApi.mockResolvedValue({
        results: [],
        total: 0,
        query: 'ab'
      });

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'ab');

      await waitFor(() => {
        expect(mockSearchApi).toHaveBeenCalledWith('ab');
      });
    });

    it('should show loading state while searching', async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      mockSearchApi.mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Searching...')).toBeInTheDocument();
      });
    });
  });

  describe('Search Results Display', () => {
    it('should display search results in dropdown', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: 'Garcia Family',
            familyId: 1,
            familyName: 'Garcia Family'
          },
          {
            id: 2,
            type: 'child' as const,
            name: 'Maria Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 2,
        query: 'garcia'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'garcia');

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
        expect(screen.getByText('Maria Garcia')).toBeInTheDocument();
      });
    });

    it('should display "No results found" message for empty results', async () => {
      const user = userEvent.setup();
      mockSearchApi.mockResolvedValue({
        results: [],
        total: 0,
        query: 'nonexistent'
      });

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No results found.')).toBeInTheDocument();
      });
    });

    it('should display error message on search failure', async () => {
      const user = userEvent.setup();
      mockSearchApi.mockRejectedValue(new Error('Search failed'));

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Search failed. Please try again.')).toBeInTheDocument();
      });
    });

    it('should show family name for non-family results', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 1,
            type: 'parent' as const,
            name: 'John Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'john'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'john');

      await waitFor(() => {
        expect(screen.getByText('John Garcia')).toBeInTheDocument();
        expect(screen.getByText('Family: Garcia Family')).toBeInTheDocument();
      });
    });

    it('should display result type badges', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: 'Garcia Family',
            familyId: 1,
            familyName: 'Garcia Family'
          },
          {
            id: 2,
            type: 'parent' as const,
            name: 'John Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          },
          {
            id: 3,
            type: 'child' as const,
            name: 'Maria Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 3,
        query: 'garcia'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'garcia');

      await waitFor(() => {
        expect(screen.getByText('Family')).toBeInTheDocument();
        expect(screen.getByText('Parent')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
      });
    });

    it('should handle unnamed results', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: null,
            familyId: 1,
            familyName: null
          }
        ],
        total: 1,
        query: 'test'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Unnamed')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to family page when family result is clicked', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: 'Garcia Family',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'garcia'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'garcia');

      await waitFor(() => {
        const familyResult = screen.getByText('Garcia Family');
        expect(familyResult).toBeInTheDocument();
      });

      const familyButton = screen.getByRole('button');
      await user.click(familyButton);

      expect(mockNavigate).toHaveBeenCalledWith('/families/1');
    });

    it('should navigate to parent page when parent result is clicked', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 2,
            type: 'parent' as const,
            name: 'John Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'john'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'john');

      await waitFor(() => {
        const parentResult = screen.getByText('John Garcia');
        expect(parentResult).toBeInTheDocument();
      });

      const parentButton = screen.getByRole('button');
      await user.click(parentButton);

      expect(mockNavigate).toHaveBeenCalledWith('/families/1/parents/2');
    });

    it('should navigate to child page when child result is clicked', async () => {
      const user = userEvent.setup();
      const mockResults = {
        results: [
          {
            id: 3,
            type: 'child' as const,
            name: 'Maria Garcia',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'maria'
      };
      mockSearchApi.mockResolvedValue(mockResults);

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'maria');

      await waitFor(() => {
        const childResult = screen.getByText('Maria Garcia');
        expect(childResult).toBeInTheDocument();
      });

      const childButton = screen.getByRole('button');
      await user.click(childButton);

      expect(mockNavigate).toHaveBeenCalledWith('/families/1/children/3');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close dropdown and clear input on Escape key', async () => {
      const user = userEvent.setup();
      mockSearchApi.mockResolvedValue({
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: 'Garcia Family',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'garcia'
      });

      render(
        <TestWrapper>
          <SearchBar />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'garcia');

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(input).toHaveValue('');
      await waitFor(() => {
        expect(screen.queryByText('Garcia Family')).not.toBeInTheDocument();
      });
    });
  });

  describe('Click Outside Behavior', () => {
    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup();
      mockSearchApi.mockResolvedValue({
        results: [
          {
            id: 1,
            type: 'family' as const,
            name: 'Garcia Family',
            familyId: 1,
            familyName: 'Garcia Family'
          }
        ],
        total: 1,
        query: 'garcia'
      });

      render(
        <TestWrapper>
          <div>
            <SearchBar />
            <div data-testid="outside-element">Outside</div>
          </div>
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'garcia');

      await waitFor(() => {
        expect(screen.getByText('Garcia Family')).toBeInTheDocument();
      });

      const outsideElement = screen.getByTestId('outside-element');
      fireEvent.mouseDown(outsideElement);

      await waitFor(() => {
        expect(screen.queryByText('Garcia Family')).not.toBeInTheDocument();
      });
    });
  });
});