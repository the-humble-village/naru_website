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
  });

  it('links to the programs and question set pages', () => {
    const { container } = renderWithRouter(<AdminPage />);
    expect(container.querySelector('a[href="/admin/programs"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/question-sets"]')).not.toBeNull();
    expect(container.querySelector('a[href="/admin/examination-types"]')).not.toBeNull();
  });

  it('should show admin sections for admin users', () => {
    renderWithRouter(<AdminPage />);

    // Admin-only sections should be visible
    expect(screen.getByText('My Team')).toBeInTheDocument();
    expect(screen.getByText('Communities')).toBeInTheDocument();
    expect(screen.getByText('Sites')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Examination Types')).toBeInTheDocument();

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
    expect(screen.getByRole('link', { name: /Examination Types/ })).toHaveAttribute('href', '/admin/examination-types');
  });
});

describe('AdminPage - Role-based access', () => {
  it('should hide admin-only sections for supervisors', () => {
    const supervisorUser = { ...mockUser, role: 'SUPERVISOR' as const };

    mockUseAuthStore.mockReturnValue({
      user: supervisorUser,
    });

    const { container } = renderWithRouter(<AdminPage />);

    // Supervisor should not see admin-only sections
    expect(container.querySelector('a[href="/admin/programs"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/question-sets"]')).toBeNull();
    expect(screen.queryByText('My Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Communities')).not.toBeInTheDocument();
    expect(screen.queryByText('Sites')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Examination Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Family Visit')).not.toBeInTheDocument();

    // But should see birthing assistants
    expect(screen.getByText('Birthing Assistants')).toBeInTheDocument();
  });

  it('should hide all admin sections for caseworkers', () => {
    const caseworkerUser = { ...mockUser, role: 'CASEWORKER' as const };

    mockUseAuthStore.mockReturnValue({
      user: caseworkerUser,
    });

    const { container } = renderWithRouter(<AdminPage />);

    // Caseworker should not see any admin sections
    expect(container.querySelector('a[href="/admin/programs"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/question-sets"]')).toBeNull();
    expect(screen.queryByText('My Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Communities')).not.toBeInTheDocument();
    expect(screen.queryByText('Sites')).not.toBeInTheDocument();
    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
    expect(screen.queryByText('Training')).not.toBeInTheDocument();
    expect(screen.queryByText('Examination Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Family Visit')).not.toBeInTheDocument();
    expect(screen.queryByText('Birthing Assistants')).not.toBeInTheDocument();
  });
});