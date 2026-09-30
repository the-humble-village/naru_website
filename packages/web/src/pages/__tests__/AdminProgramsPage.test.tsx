import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AdminProgramsPage } from '../admin/AdminProgramsPage';
import { programsApi } from '../../api/programs';
import { type ProgramRead } from '@naru/shared';

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),
  },
}));

const mockAdminUser = {
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

const mockUser = vi.fn(() => mockAdminUser as { role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' });

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: mockUser() }),
}));

const nutrition: ProgramRead = {
  id: 1,
  name: 'Nutrition Infant',
  kind: 'NUTRITION',
  subjectType: 'CHILD',
  description: 'Under two',
  minAgeMonths: 0,
  maxAgeMonths: 24,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const midwives: ProgramRead = {
  id: 2,
  name: 'Midwives',
  kind: 'MIDWIFE',
  subjectType: 'PERSON',
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: null,
  active: false,
  sortOrder: 4,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/admin/programs']}>
      <QueryClientProvider client={queryClient}>
        <AdminProgramsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const rowFor = (name: string): HTMLElement => {
  const table = screen.getByRole('table');
  return within(table).getByText(name).closest('tr') as HTMLElement;
};

describe('AdminProgramsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(mockAdminUser);
    vi.mocked(programsApi.listPrograms).mockResolvedValue({
      items: [nutrition, midwives],
      total: 2,
    });
  });

  it('lists every program, active and inactive', async () => {
    renderPage();

    await screen.findByRole('table');
    expect(within(rowFor('Nutrition Infant')).getByText('30 admin.program_days_short')).toBeInTheDocument();
    expect(within(rowFor('Midwives')).getByText('admin.program_never_overdue')).toBeInTheDocument();
    expect(programsApi.listPrograms).toHaveBeenCalledWith({});
  });

  it('hides the page from non-admin users', async () => {
    mockUser.mockReturnValue({ ...mockAdminUser, role: 'SUPERVISOR' });

    const { container } = renderPage();

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('derives the subject type from the kind on create and never asks for it', async () => {
    const user = userEvent.setup();
    vi.mocked(programsApi.createProgram).mockResolvedValue(nutrition);

    renderPage();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: /admin.program_add/ }));
    await user.type(screen.getByLabelText(/Name/), 'Youth 2026');
    await user.selectOptions(screen.getByLabelText(/admin.program_kind/), 'STUDENT');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(programsApi.createProgram).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'STUDENT', subjectType: 'PERSON' })
      );
    });
  });

  it('renders kind and subject read-only when editing', async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findByRole('table');

    await user.click(within(rowFor('Nutrition Infant')).getByRole('button', { name: 'Edit' }));

    expect(screen.queryByRole('combobox', { name: /admin.program_kind/ })).not.toBeInTheDocument();
    expect(screen.getByText('admin.program_kind_locked')).toBeInTheDocument();
    expect(screen.getByText('admin.program_subject_locked')).toBeInTheDocument();
  });

  it('omits kind and subject type from the update payload', async () => {
    const user = userEvent.setup();
    vi.mocked(programsApi.updateProgram).mockResolvedValue(nutrition);

    renderPage();
    await screen.findByRole('table');

    await user.click(within(rowFor('Nutrition Infant')).getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(programsApi.updateProgram).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(programsApi.updateProgram).mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('kind');
    expect(payload).not.toHaveProperty('subjectType');
  });

  it('toggles active straight from the row', async () => {
    const user = userEvent.setup();
    vi.mocked(programsApi.updateProgram).mockResolvedValue({ ...nutrition, active: false });

    renderPage();
    await screen.findByRole('table');

    await user.click(
      within(rowFor('Nutrition Infant')).getByRole('button', { name: 'admin.program_deactivate' })
    );

    await waitFor(() => {
      expect(programsApi.updateProgram).toHaveBeenCalledWith(1, { active: false });
    });
  });

  it('surfaces a refused delete and offers deactivation instead', async () => {
    const user = userEvent.setup();
    vi.mocked(programsApi.deleteProgram).mockRejectedValue(
      new Error('Cannot delete a program with 12 active enrollment(s).')
    );
    vi.mocked(programsApi.updateProgram).mockResolvedValue({ ...nutrition, active: false });

    renderPage();
    await screen.findByRole('table');

    await user.click(within(rowFor('Nutrition Infant')).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/12 active enrollment/)).toBeInTheDocument();

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'admin.program_deactivate_instead',
      })
    );

    await waitFor(() => {
      expect(programsApi.updateProgram).toHaveBeenCalledWith(1, { active: false });
    });
  });
});
