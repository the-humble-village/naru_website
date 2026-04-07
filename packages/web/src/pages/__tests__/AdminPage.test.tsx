import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminPage } from '../admin/AdminPage';

// Mock the auth store
const mockUser = {
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

const mockUseAuthStore = vi.fn();

vi.mock('../../store/auth', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('AdminPage', () => {
  beforeEach(() => {
    // Reset mock to default admin user
    mockUseAuthStore.mockReturnValue({
      user: mockUser,
    });
  });

  it('should render admin section headings', () => {
    renderWithRouter(<AdminPage />);
    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('Lookup Tables')).toBeInTheDocument();
    expect(screen.getByText('Visit Questions')).toBeInTheDocument();
  });

  it('should show admin sections for admin users', () => {
    renderWithRouter(<AdminPage />);

    // Admin-only sections should be visible
    expect(screen.getByText('My Team')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
    expect(screen.getByText('Sites')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Child Visit')).toBeInTheDocument();
    expect(screen.getByText('Parent Visit')).toBeInTheDocument();
    expect(screen.getByText('Family Visit')).toBeInTheDocument();

    // Supervisor+ sections should also be visible
    expect(screen.getByText('Birthing Assistants')).toBeInTheDocument();
  });

  it('should have working navigation links', () => {
    renderWithRouter(<AdminPage />);

    // Check that links are present with correct href attributes
    expect(screen.getByRole('link', { name: /My Team/ })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: /Communities/ })).toHaveAttribute('href', '/admin/communities');
    expect(screen.getByRole('link', { name: /Sites/ })).toHaveAttribute('href', '/admin/sites');
    expect(screen.getByRole('link', { name: /Resources/ })).toHaveAttribute('href', '/admin/resources');
    expect(screen.getByRole('link', { name: /Training/ })).toHaveAttribute('href', '/admin/training');
    expect(screen.getByRole('link', { name: /Birthing Assistants/ })).toHaveAttribute('href', '/admin/birthing-assistants');
    expect(screen.getByRole('link', { name: /^Child Visit$/ })).toHaveAttribute('href', '/admin/question-sets/child');
    expect(screen.getByRole('link', { name: /^Parent Visit$/ })).toHaveAttribute('href', '/admin/question-sets/parent');
    expect(screen.getByRole('link', { name: /^Family Visit$/ })).toHaveAttribute('href', '/admin/question-sets/family');
  });
});

describe('AdminPage - Role-based access', () => {
  it('should hide admin-only sections for supervisors', () => {
    const supervisorUser = { ...mockUser, role: 'SUPERVISOR' as const };

    mockUseAuthStore.mockReturnValue({
      user: supervisorUser,
    });

    renderWithRouter(<AdminPage />);

    // Supervisor should not see admin-only sections
    expect(screen.queryByText('My Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Communities')).not.toBeInTheDocument();
    expect(screen.queryByText('Sites')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Child Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Parent Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Family Visit')).not.toBeInTheDocument();

    // But should see birthing assistants
    expect(screen.getByText('Birthing Assistants')).toBeInTheDocument();
  });

  it('should hide all admin sections for caseworkers', () => {
    const caseworkerUser = { ...mockUser, role: 'CASEWORKER' as const };

    mockUseAuthStore.mockReturnValue({
      user: caseworkerUser,
    });

    renderWithRouter(<AdminPage />);

    // Caseworker should not see any admin sections
    expect(screen.queryByText('My Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Communities')).not.toBeInTheDocument();
    expect(screen.queryByText('Sites')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Child Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Parent Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Family Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Birthing Assistants')).not.toBeInTheDocument();
  });
});