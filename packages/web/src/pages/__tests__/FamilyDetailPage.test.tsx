import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnrollmentListItem } from '@naru/shared';
import FamilyDetailPage from '../families/FamilyDetailPage';
import { fetchFamily, deleteFamily } from '../../api/families';
import { listMothers } from '../../api/mothers';
import { listChildren } from '../../api/children';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import { listVisits } from '../../api/visits';

vi.mock('../../api/families', () => ({ fetchFamily: vi.fn(), deleteFamily: vi.fn() }));
vi.mock('../../api/mothers', () => ({ listMothers: vi.fn() }));
vi.mock('../../api/children', () => ({ listChildren: vi.fn() }));
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
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: '1' }) };
});

const family = {
  id: 1,
  localId: null,
  familyName: 'Familia López',
  communityId: 3,
  phone: '555-0100',
  caretaker2Name: 'Tía Ana',
  incomeSources: 'Farming',
  deathsNotes: 'None recorded',
  inCrisis: false,
  notes: 'Test family notes',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const pafEnrollment: EnrollmentListItem = {
  id: 33,
  localId: null,
  programId: 6,
  motherId: null,
  childId: null,
  personId: null,
  familyId: 1,
  enrolledAt: '2025-03-01',
  entryWeight: null,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2025-03-01T00:00:00.000Z',
  updatedAt: '2025-03-01T00:00:00.000Z',
  program: { id: 6, name: 'PAF', kind: 'FAMILY_PAF', subjectType: 'FAMILY' },
  subjectName: 'Familia López',
  visitCount: 4,
  lastVisitDate: '2026-02-01',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FamilyDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('FamilyDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = 'SUPERVISOR';
    vi.mocked(fetchFamily).mockResolvedValue(family);
    vi.mocked(listMothers).mockResolvedValue({
      items: [
        {
          id: 5,
          localId: null,
          name: 'María López',
          birthDate: '1998-04-02T00:00:00.000Z',
          communityId: 3,
          phone: null,
          familyId: 1,
          midwifeId: null,
          pregnancies: null,
          childrenCount: null,
          breastfedCount: null,
          malnutritionDeaths: null,
          notes: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      skip: 0,
      limit: 50,
    });
    vi.mocked(listChildren).mockResolvedValue({
      items: [
        {
          id: 21,
          localId: null,
          name: 'José Ramírez',
          birthDate: '2026-05-01T00:00:00.000Z',
          sex: 'MALE',
          communityId: 3,
          motherId: 5,
          familyId: 1,
          notes: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      total: 1,
      skip: 0,
      limit: 50,
    });
    vi.mocked(listEnrollments).mockResolvedValue({
      items: [pafEnrollment],
      total: 1,
      skip: 0,
      limit: 100,
    });
    vi.mocked(listPrograms).mockResolvedValue({
      items: [
        {
          id: 6,
          name: 'PAF',
          kind: 'FAMILY_PAF',
          subjectType: 'FAMILY',
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

  it('renders the header with the V2 family columns', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Familia López')).toBeInTheDocument());

    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('Tía Ana')).toBeInTheDocument();
    expect(screen.getByText('Farming')).toBeInTheDocument();
    expect(screen.getByText('None recorded')).toBeInTheDocument();
    expect(screen.getByText('Test family notes')).toBeInTheDocument();
    expect(fetchFamily).toHaveBeenCalledWith(1);
  });

  it('derives the site from the community rather than a field on the family', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Xela \(.*: Quetzaltenango\)/)).toBeInTheDocument()
    );
  });

  it('falls back to no site when the community names none', async () => {
    vi.mocked(fetchCommunities).mockResolvedValue([
      {
        id: 3,
        title: 'Xela',
        siteId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    renderPage();

    await waitFor(() => expect(screen.getByText('Familia López')).toBeInTheDocument());
    expect(screen.queryByText(/Quetzaltenango/)).toBeNull();
  });

  it('lists mothers and children as links, not nested detail', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /María López/ })).toHaveAttribute(
      'href',
      '/mothers/5'
    );
    expect(await screen.findByRole('link', { name: /José Ramírez/ })).toHaveAttribute(
      'href',
      '/children/21'
    );
    expect(listMothers).toHaveBeenCalledWith({ familyId: 1 });
    expect(listChildren).toHaveBeenCalledWith({ familyId: 1 });
  });

  it('shows an empty members state when nobody is linked', async () => {
    vi.mocked(listMothers).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 50 });
    vi.mocked(listChildren).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 50 });

    renderPage();

    await waitFor(() => expect(screen.getByText('families.no_members')).toBeInTheDocument());
  });

  it('renders the PAF enrollment card with its own visit action', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: /PAF/ })).toHaveAttribute(
      'href',
      '/enrollments/33'
    );
    expect(screen.getByRole('link', { name: /enrollment\.add_visit/ })).toHaveAttribute(
      'href',
      '/enrollments/33/visits/new'
    );
    expect(listEnrollments).toHaveBeenCalledWith({ familyId: 1, limit: 100 });
  });

  it('routes + Enroll in program to the wizard with the family pre-selected', async () => {
    renderPage();

    const picker = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'PAF' })).toBeInTheDocument()
    );

    fireEvent.change(picker, { target: { value: '6' } });
    expect(mockNavigate).toHaveBeenCalledWith('/programs/6/enroll?familyId=1');
  });

  it('hides delete from caseworkers and soft-deletes for a supervisor', async () => {
    authState.role = 'CASEWORKER';
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.getByText('Familia López')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    unmount();

    authState.role = 'SUPERVISOR';
    vi.mocked(deleteFamily).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText('Familia López')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteFamily).toHaveBeenCalledWith(1));
  });

  it('shows an error when the family fails to load', async () => {
    vi.mocked(fetchFamily).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('families.load_failed')).toBeInTheDocument());
  });
});
