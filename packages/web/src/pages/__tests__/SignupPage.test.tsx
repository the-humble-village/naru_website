import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SignupPage from '../auth/SignupPage';
import * as authApi from '../../api/auth';

// Mock the auth API
vi.mock('../../api/auth', () => ({
  authApi: {
    register: vi.fn(),
  },
}));

// Mock the auth store
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../store/auth', () => ({
  useAuthStore: vi.fn(() => ({
    login: mockLogin,
    logout: mockLogout,
    user: null,
    accessToken: null,
    isAuthenticated: false,
  })),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders signup form', () => {
    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByText('Create your HumbleVillage account')).toBeInTheDocument();
    expect(screen.getByLabelText('Username *')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password *')).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Username should show min length error
      expect(screen.getByText('String must contain at least 1 character(s)')).toBeInTheDocument();
      // Password should show min length error (6 characters required)
      expect(screen.getByText('String must contain at least 6 character(s)')).toBeInTheDocument();
    });
  });


  it('validates password length', async () => {
    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username *');
    const passwordInput = screen.getByLabelText('Password *');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('String must contain at least 6 character(s)')).toBeInTheDocument();
    });
  });

  it('calls API and navigates on successful registration', async () => {
    const mockAuthResponse = {
      user: {
        id: 1,
        login: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'CASEWORKER' as const,
        lang: 'en',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        localId: null,
      },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };

    (authApi.authApi.register as any).mockResolvedValue(mockAuthResponse);

    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username *');
    const emailInput = screen.getByLabelText('Email Address');
    const firstNameInput = screen.getByLabelText('First Name');
    const lastNameInput = screen.getByLabelText('Last Name');
    const passwordInput = screen.getByLabelText('Password *');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'newuser' } });
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.change(firstNameInput, { target: { value: 'New' } });
    fireEvent.change(lastNameInput, { target: { value: 'User' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authApi.authApi.register).toHaveBeenCalledWith({
        login: 'newuser',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
        lang: 'en',
      });
      expect(mockLogin).toHaveBeenCalledWith(
        mockAuthResponse.user,
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken
      );
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows API error on registration failure', async () => {
    const errorMessage = 'Username already exists';
    (authApi.authApi.register as any).mockRejectedValue({
      response: { data: { message: errorMessage } },
    });

    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username *');
    const passwordInput = screen.getByLabelText('Password *');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('navigates to login page when login link is clicked', () => {
    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const loginLink = screen.getByText('Sign in here');
    fireEvent.click(loginLink);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('allows changing language selection', () => {
    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const languageSelect = screen.getByLabelText('Language');
    expect(languageSelect).toHaveValue('en');

    fireEvent.change(languageSelect, { target: { value: 'es' } });
    expect(languageSelect).toHaveValue('es');
  });

  it('shows loading state during form submission', async () => {
    let resolveSignup: any;
    const signupPromise = new Promise(resolve => {
      resolveSignup = () => resolve({
        user: { id: 1, login: 'testuser' },
        accessToken: 'abc',
        refreshToken: 'def'
      });
    });

    (authApi.authApi.register as any).mockReturnValue(signupPromise);

    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username *');
    const passwordInput = screen.getByLabelText('Password *');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Creating account...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Clean up
    resolveSignup();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it('handles optional fields correctly', async () => {
    const mockAuthResponse = {
      user: {
        id: 1,
        login: 'minimaluser',
        email: null,
        firstName: null,
        lastName: null,
        role: 'CASEWORKER' as const,
        lang: 'en',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        localId: null,
      },
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
    };

    (authApi.authApi.register as any).mockResolvedValue(mockAuthResponse);

    render(
      <TestWrapper>
        <SignupPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText('Username *');
    const passwordInput = screen.getByLabelText('Password *');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });

    // Only fill required fields
    fireEvent.change(usernameInput, { target: { value: 'minimaluser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authApi.authApi.register).toHaveBeenCalledWith({
        login: 'minimaluser',
        email: null,
        firstName: null,
        lastName: null,
        password: 'password123',
        lang: 'en',
      });
    });
  });
});