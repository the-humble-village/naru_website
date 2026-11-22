import React from 'react';
import { render } from '@testing-library/react';
import { RoleGate } from '../RoleGate';
import { useAuthStore } from '../../store/auth';
import type { User } from '../../store/auth';

// Mock the auth store
vi.mock('../../store/auth');

const MockedUseAuthStore = vi.mocked(useAuthStore);

// Test component
const TestComponent = () => <div>Protected Content</div>;
const FallbackComponent = () => <div>Access Denied</div>;

const createMockUser = (role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER'): User => ({
  id: 1,
  login: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role,
  lang: 'en',
});

const createMockAuthState = (user: User | null) => ({
  user,
  isAuthenticated: !!user,
  accessToken: user ? 'valid-token' : null,
  refreshToken: user ? 'refresh-token' : null,
  role: user?.role || null,
  lang: user?.lang || 'en',
  setTokens: vi.fn(),
  setUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  setLanguage: vi.fn(),
});

describe('RoleGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when no role requirement is specified', () => {
    const mockUser = createMockUser('CASEWORKER');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <RoleGate>
        <TestComponent />
      </RoleGate>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when user is not authenticated', () => {
    MockedUseAuthStore.mockReturnValue(createMockAuthState(null));

    const { getByText, queryByText } = render(
      <RoleGate requiredRole="CASEWORKER" fallback={<FallbackComponent />}>
        <TestComponent />
      </RoleGate>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Access Denied')).toBeInTheDocument();
  });

  it('should render children when CASEWORKER has CASEWORKER role', () => {
    const mockUser = createMockUser('CASEWORKER');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <RoleGate requiredRole="CASEWORKER">
        <TestComponent />
      </RoleGate>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when CASEWORKER tries to access SUPERVISOR role', () => {
    const mockUser = createMockUser('CASEWORKER');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText, queryByText } = render(
      <RoleGate requiredRole="SUPERVISOR" fallback={<FallbackComponent />}>
        <TestComponent />
      </RoleGate>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Access Denied')).toBeInTheDocument();
  });

  it('should render children when SUPERVISOR has CASEWORKER role', () => {
    const mockUser = createMockUser('SUPERVISOR');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <RoleGate requiredRole="CASEWORKER">
        <TestComponent />
      </RoleGate>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render children when SUPERVISOR has SUPERVISOR role', () => {
    const mockUser = createMockUser('SUPERVISOR');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <RoleGate requiredRole="SUPERVISOR">
        <TestComponent />
      </RoleGate>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when SUPERVISOR tries to access ADMIN role', () => {
    const mockUser = createMockUser('SUPERVISOR');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText, queryByText } = render(
      <RoleGate requiredRole="ADMIN" fallback={<FallbackComponent />}>
        <TestComponent />
      </RoleGate>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Access Denied')).toBeInTheDocument();
  });

  it('should render children when ADMIN has any role', () => {
    const mockUser = createMockUser('ADMIN');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <>
        <RoleGate requiredRole="CASEWORKER">
          <div>Admin as Caseworker</div>
        </RoleGate>
        <RoleGate requiredRole="SUPERVISOR">
          <div>Admin as Supervisor</div>
        </RoleGate>
        <RoleGate requiredRole="ADMIN">
          <div>Admin as Admin</div>
        </RoleGate>
      </>
    );

    expect(getByText('Admin as Caseworker')).toBeInTheDocument();
    expect(getByText('Admin as Supervisor')).toBeInTheDocument();
    expect(getByText('Admin as Admin')).toBeInTheDocument();
  });

  it('should handle multiple required roles (array)', () => {
    const mockUser = createMockUser('SUPERVISOR');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText } = render(
      <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
        <TestComponent />
      </RoleGate>
    );

    expect(getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when user role not in required roles array', () => {
    const mockUser = createMockUser('CASEWORKER');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { getByText, queryByText } = render(
      <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']} fallback={<FallbackComponent />}>
        <TestComponent />
      </RoleGate>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
    expect(getByText('Access Denied')).toBeInTheDocument();
  });

  it('should render nothing when no fallback is provided and access is denied', () => {
    const mockUser = createMockUser('CASEWORKER');
    MockedUseAuthStore.mockReturnValue(createMockAuthState(mockUser));

    const { queryByText } = render(
      <RoleGate requiredRole="ADMIN">
        <TestComponent />
      </RoleGate>
    );

    expect(queryByText('Protected Content')).not.toBeInTheDocument();
  });
});