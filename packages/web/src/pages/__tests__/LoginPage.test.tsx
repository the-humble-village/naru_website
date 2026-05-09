import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from '../auth/LoginPage';
import * as authApi from '../../api/auth';
import { en } from '@naru/shared';

// Mock the auth API
vi.mock('../../api/auth', () => ({
  authApi: {
    login: vi.fn(),
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
    lang: 'en',
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('renders login form', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    expect(screen.getByText(en['login.title'])).toBeInTheDocument();
    expect(screen.getByText(en['login.app_title'])).toBeInTheDocument();
    expect(screen.getByLabelText(en['login.hint_login'])).toBeInTheDocument();
    expect(screen.getByLabelText(en['login.hint_password'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en['login.button'] })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: en['login.button'] });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText('String must contain at least 1 character(s)')).toHaveLength(2); // username and password
    });
  });

  it('calls API when valid credentials are provided', async () => {
    (authApi.authApi.login as any).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText(en['login.hint_login']);
    const passwordInput = screen.getByLabelText(en['login.hint_password']);
    const submitButton = screen.getByRole('button', { name: en['login.button'] });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'a' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Since validation passes (min 1 char), API should be called
      expect(authApi.authApi.login).toHaveBeenCalledWith({
        login: 'testuser',
        password: 'a',
      });
    });
  });

  it('calls API and navigates on successful login', async () => {
    const mockAuthResponse = {
      user: {
        id: 1,
        login: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
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

    (authApi.authApi.login as any).mockResolvedValue(mockAuthResponse);

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText(en['login.hint_login']);
    const passwordInput = screen.getByLabelText(en['login.hint_password']);
    const submitButton = screen.getByRole('button', { name: en['login.button'] });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authApi.authApi.login).toHaveBeenCalledWith({
        login: 'testuser',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        mockAuthResponse.user,
        mockAuthResponse.accessToken,
        mockAuthResponse.refreshToken
      );
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows API error on login failure', async () => {
    const errorMessage = 'Invalid credentials';
    (authApi.authApi.login as any).mockRejectedValue({
      response: { data: { message: errorMessage } },
    });

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText(en['login.hint_login']);
    const passwordInput = screen.getByLabelText(en['login.hint_password']);
    const submitButton = screen.getByRole('button', { name: en['login.button'] });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('navigates to signup page when signup link is clicked', () => {
    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const signupLink = screen.getByText(en['login.create_account']);
    fireEvent.click(signupLink);

    expect(mockNavigate).toHaveBeenCalledWith('/signup');
  });

  it('shows loading state during form submission', async () => {
    let resolveLogin: any;
    const loginPromise = new Promise(resolve => {
      resolveLogin = () => resolve({
        user: { id: 1, login: 'testuser' },
        accessToken: 'abc',
        refreshToken: 'def'
      });
    });

    (authApi.authApi.login as any).mockReturnValue(loginPromise);

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>
    );

    const usernameInput = screen.getByLabelText(en['login.hint_login']);
    const passwordInput = screen.getByLabelText(en['login.hint_password']);
    const submitButton = screen.getByRole('button', { name: en['login.button'] });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();

    // Clean up
    resolveLogin();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });
});