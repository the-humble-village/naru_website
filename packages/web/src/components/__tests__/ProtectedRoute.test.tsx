import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuthStore } from '../../store/auth';

// Mock the auth store
vi.mock('../../store/auth');

const MockedUseAuthStore = vi.mocked(useAuthStore);

// Test component
const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Login Page</div>;

// Wrapper component for testing with router
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginComponent />} />
      <Route path="/protected" element={children} />
    </Routes>
  </BrowserRouter>
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user is authenticated', () => {
    MockedUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      accessToken: 'valid-token',
      user: {
        id: 1,
        login: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'CASEWORKER' as const,
        lang: 'en',
      },
      refreshToken: 'refresh-token',
      role: 'CASEWORKER',
      lang: 'en',
      setTokens: vi.fn(),
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      setLanguage: vi.fn(),
    });

    // Mock useLocation to return a test location
    const mockLocation = { pathname: '/protected', state: null, search: '', hash: '', key: 'default' };
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useLocation: () => mockLocation,
      };
    });

    // Set initial URL to /protected
    window.history.pushState({}, '', '/protected');

    const { getByText } = render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    MockedUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      refreshToken: null,
      role: null,
      lang: 'en',
      setTokens: vi.fn(),
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      setLanguage: vi.fn(),
    });

    // Mock useLocation to return a test location
    const mockLocation = { pathname: '/protected', state: null, search: '', hash: '', key: 'default' };
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useLocation: () => mockLocation,
      };
    });

    // Set initial URL to /protected
    window.history.pushState({}, '', '/protected');

    const { getByText, queryByText } = render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Login Page')).toBeInTheDocument();
  });

  it('should redirect to login when access token is null', () => {
    MockedUseAuthStore.mockReturnValue({
      isAuthenticated: true, // authenticated but no token
      accessToken: null,
      user: {
        id: 1,
        login: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'CASEWORKER' as const,
        lang: 'en',
      },
      refreshToken: 'refresh-token',
      role: 'CASEWORKER',
      lang: 'en',
      setTokens: vi.fn(),
      setUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      setLanguage: vi.fn(),
    });

    // Mock useLocation to return a test location
    const mockLocation = { pathname: '/protected', state: null, search: '', hash: '', key: 'default' };
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useLocation: () => mockLocation,
      };
    });

    // Set initial URL to /protected
    window.history.pushState({}, '', '/protected');

    const { getByText, queryByText } = render(
      <TestWrapper>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </TestWrapper>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Login Page')).toBeInTheDocument();
  });
});