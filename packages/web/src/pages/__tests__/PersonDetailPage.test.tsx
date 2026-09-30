import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnrollmentListItem } from '@naru/shared';
import PersonDetailPage from '../people/PersonDetailPage';
import { fetchPerson, fetchAssignedMothers, deletePerson } from '../../api/people';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import { listVisits } from '../../api/visits';

vi.mock('../../api/people', () => ({
  fetchPerson: vi.fn(),
  fetchAssignedMothers: vi.fn(),
  deletePerson: vi.fn(),
}));
vi.mock('../../api/enrollments', () => ({
  listEnrollments: vi.fn(),
  reopenEnrollment: vi.fn(),
}));
vi.mock('../../api/programs', () => ({ listPrograms: vi.fn() }));
vi.mock('../../api/admin', () => ({ fetchCommunities: vi.fn(), fetchSites: vi.fn() }));
vi.mock('../../api/visits', () => ({ listVisits: vi.fn() }));

const authState: { role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER' } = { role: 'SUPERVISOR' };

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    lang: 'en',
    user: {
      id: 1,
      login: 'u',
      email: null,
      firstName: null,
      lastName: null,
      role: authState.role,
      lang: 'en',
    },
  }),
}));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: '12' }) };
});

const person = {
  id: 12,
  localId: null,
  name: 'Juana Ramírez',
  birthDate: '1985-06-01T00:00:00.000Z',
  sex: 'FEMALE' as const,
  communityId: 3,
  phone: '5599-0011',
  notes: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const midwifeEnrollment: EnrollmentListItem = {
  id: 90,
  localId: null,
  programId: 4,
  motherId: null,
  childId: null,
  personId: 12,
  familyId: null,
  enrolledAt: '2025-02-01',
  entryWeight: null,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2025-02-01T00:00:00.000Z',
  updatedAt: '2025-02-01T00:00:00.000Z',
  program: { id: 4, name: 'Midwives', kind: 'MIDWIFE', subjectType: 'PERSON' },
  subjectName: 'Juana Ramírez',
  visitCount: 2,
  lastVisitDate: '2026-05-01',
};

const studentEnrollment: EnrollmentListItem = {
  ...midwifeEnrollment,
  id: 91,
  programId: 5,
  enrolledAt: '2023-01-01',
  exitedAt: '2024-06-01',
  exitReason: 'GRADUATED',
  program: { id: 5, name: 'Youth', kind: 'STUDENT', subjectType: 'PERSON' },
  studentDetail: { school: 'Escuela', classYear: '3' },
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PersonDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PersonDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = 'SUPERVISOR';
    vi.mocked(fetchPerson).mockResolvedValue(person);
    vi.mocked(listEnrollments).mockResolvedValue({
      items: [studentEnrollment, midwifeEnrollment],
      total: 2,
      skip: 0,
      limit: 100,
    });
    vi.mocked(fetchAssignedMothers).mockResolvedValue({
      items: [{ id: 5, name: 'María López', communityId: 3 }],
      total: 1,
    });
    vi.mocked(listPrograms).mockResolvedValue({
      items: [
        {
          id: 4,
          name: 'Midwives',
          kind: 'MIDWIFE',
          subjectType: 'PERSON',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: null,
          active: true,
          sortOrder: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
    });
    vi.mocked(fetchCommunities).mockResolvedValue([
      {
        id: 3,
        title: 'Xela',
        siteId: 8,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(fetchSites).mockResolvedValue([
      {
        id: 8,
        title: 'Quetzaltenango',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(listVisits).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 3 });
  });

  it('renders the header with the derived site', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Juana Ramírez')).toBeInTheDocument());
    expect(screen.getByText(/Xela \(.*: Quetzaltenango\)/)).toBeInTheDocument();
    expect(screen.getByText('5599-0011')).toBeInTheDocument();
    expect(fetchPerson).toHaveBeenCalledWith(12);
  });

  it('lists the assigned mothers for a midwife', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'María López' });
    expect(link).toHaveAttribute('href', '/mothers/5');
    expect(fetchAssignedMothers).toHaveBeenCalledWith(12);
  });

  it('does not query the caseload for a person outside the Midwives program', async () => {
    vi.mocked(listEnrollments).mockResolvedValue({
      items: [studentEnrollment],
      total: 1,
      skip: 0,
      limit: 100,
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Juana Ramírez')).toBeInTheDocument());
    await waitFor(() => expect(listEnrollments).toHaveBeenCalled());
    expect(fetchAssignedMothers).not.toHaveBeenCalled();
  });

  it('orders active enrollments before exited ones', async () => {
    renderPage();

    const active = await screen.findByRole('link', { name: /Midwives/ });
    const exited = await screen.findByText(/2023-01 → 2024-06/);
    expect(active.compareDocumentPosition(exited) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('routes + Enroll in program to the wizard with the person pre-selected', async () => {
    renderPage();

    const picker = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'Midwives' })).toBeInTheDocument()
    );

    fireEvent.change(picker, { target: { value: '4' } });
    expect(mockNavigate).toHaveBeenCalledWith('/programs/4/enroll?personId=12');
  });

  it('hides delete from caseworkers and soft-deletes for a supervisor', async () => {
    authState.role = 'CASEWORKER';
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.getByText('Juana Ramírez')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    unmount();

    authState.role = 'SUPERVISOR';
    vi.mocked(deletePerson).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText('Juana Ramírez')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletePerson).toHaveBeenCalledWith(12));
  });

  it('shows an error when the person fails to load', async () => {
    vi.mocked(fetchPerson).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('people.load_failed')).toBeInTheDocument());
  });
});
