import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AdminPage } from '../admin/AdminPage';

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

const renderPage = () => render(
  <MemoryRouter>
    <AdminPage />
  </MemoryRouter>
);

describe('AdminPage', () => {
  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ user: mockUser, lang: 'en' });
  });

  it('renders the administration heading and the three named sections', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Administration', level: 1 })).toBeInTheDocument();
    for (const name of ['People', 'Programs', 'Reference Data']) {
      expect(screen.getByRole('heading', { name, level: 2 })).toBeInTheDocument();
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
  });

  it('groups all destinations under the appropriate sections', () => {
    renderPage();
    expect(screen.getAllByRole('link')).toHaveLength(9);
    for (const [category, labels] of [
      ['People', ['My Team', 'Birthing Assistants']],
      ['Programs', ['Programs', 'Question Sets']],
      ['Reference Data', ['Communities', 'Sites', 'Resources', 'Training', 'Examination Types']],
    ] as const) {
      const section = within(screen.getByRole('region', { name: category }));
      expect(section.getAllByRole('link')).toHaveLength(labels.length);
      for (const label of labels) {
        expect(section.getByRole('link', { name: label })).toBeInTheDocument();
      }
    }
  });

  it('preserves navigation and accessible card descriptions', () => {
    renderPage();
    for (const [name, path] of [
      ['My Team', 'users'],
      ['Birthing Assistants', 'birthing-assistants'],
      ['Programs', 'programs'],
      ['Question Sets', 'question-sets'],
      ['Communities', 'communities'],
      ['Sites', 'sites'],
      ['Resources', 'resources'],
      ['Training', 'training'],
      ['Examination Types', 'examination-types'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/admin/${path}`);
    }
    expect(screen.getByRole('link', { name: 'My Team' })).toHaveAccessibleDescription('Accounts and permissions');
  });

  it('translates the heading, sections, and descriptions into Spanish', () => {
    mockUseAuthStore.mockReturnValue({ user: { ...mockUser, lang: 'es' }, lang: 'es' });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Administración', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Personas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Programas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Datos de referencia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi Equipo' })).toHaveAccessibleDescription('Cuentas y permisos');
  });

  it('shows only the permitted People section for a supervisor', () => {
    mockUseAuthStore.mockReturnValue({ user: { ...mockUser, role: 'SUPERVISOR' }, lang: 'en' });
    renderPage();
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Birthing Assistants' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My Team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Programs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Reference Data' })).not.toBeInTheDocument();
  });

  it('updates the visible sections when permissions change', () => {
    const { rerender } = renderPage();
    expect(screen.getAllByRole('link')).toHaveLength(9);
    mockUseAuthStore.mockReturnValue({ user: { ...mockUser, role: 'SUPERVISOR' }, lang: 'en' });
    rerender(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Birthing Assistants' })).toBeInTheDocument();
  });

  it.each(['CASEWORKER', null])('hides all admin destinations without a staff role (%s)', role => {
    mockUseAuthStore.mockReturnValue({ user: role ? { ...mockUser, role } : null, lang: 'en' });
    renderPage();
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
