import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnrollmentListItem } from '@naru/shared';
import MotherDetailPage from '../mothers/MotherDetailPage';
import { fetchMother, deleteMother } from '../../api/mothers';
import { fetchPerson } from '../../api/people';
import { listChildren } from '../../api/children';
import { fetchFamily } from '../../api/families';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import { fetchBirthingAssistants } from '../../api/birthing-assistants';
import { listVisits } from '../../api/visits';

vi.mock('../../api/mothers', () => ({
  fetchMother: vi.fn(),
  deleteMother: vi.fn(),
  listMothers: vi.fn(),
}));
vi.mock('../../api/people', () => ({ fetchPerson: vi.fn() }));
vi.mock('../../api/children', () => ({ listChildren: vi.fn() }));
vi.mock('../../api/families', () => ({ fetchFamily: vi.fn() }));
vi.mock('../../api/enrollments', () => ({
  listEnrollments: vi.fn(),
  reopenEnrollment: vi.fn(),
}));
vi.mock('../../api/programs', () => ({ listPrograms: vi.fn() }));
vi.mock('../../api/admin', () => ({ fetchCommunities: vi.fn(), fetchSites: vi.fn() }));
vi.mock('../../api/birthing-assistants', () => ({ fetchBirthingAssistants: vi.fn() }));
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
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: '5' }) };
});

const mother = {
  id: 5,
  localId: null,
  name: 'María López',
  birthDate: '1998-04-02T00:00:00.000Z',
  communityId: 3,
  phone: '5512-3344',
  familyId: 9,
  midwifeId: 12,
  pregnancies: 3,
  childrenCount: 2,
  breastfedCount: 2,
  malnutritionDeaths: 0,
  notes: 'Prefers home visits',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const enrollment: EnrollmentListItem = {
  id: 77,
  localId: null,
  programId: 1,
  motherId: 5,
  childId: null,
  personId: null,
  familyId: null,
  enrolledAt: '2026-04-02',
  entryWeight: 58.2,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2026-04-02T00:00:00.000Z',
  updatedAt: '2026-04-02T00:00:00.000Z',
  pregnancyDetail: { dueDate: '2026-11-15', pregnancyNumber: 3, birthingAssistantId: 4 },
  program: { id: 1, name: 'Expectant Mother', kind: 'PREGNANCY', subjectType: 'MOTHER' },
  subjectName: 'María López',
  visitCount: 6,
  lastVisitDate: '2026-09-04',
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MotherDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MotherDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = 'SUPERVISOR';
    vi.mocked(fetchMother).mockResolvedValue(mother);
    vi.mocked(fetchPerson).mockResolvedValue({
      id: 12,
      localId: null,
      name: 'Juana Ramírez',
      birthDate: null,
      sex: null,
      communityId: null,
      phone: null,
      notes: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    vi.mocked(fetchFamily).mockResolvedValue({
      id: 9,
      localId: null,
      familyName: 'Familia López',
      communityId: 3,
      phone: null,
      caretaker2Name: null,
      incomeSources: null,
      deathsNotes: null,
      inCrisis: false,
      notes: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    vi.mocked(listChildren).mockResolvedValue({
      items: [
        {
          id: 21,
          localId: null,
          name: 'José',
          birthDate: '2026-05-01T00:00:00.000Z',
          sex: 'MALE',
          communityId: 3,
          motherId: 5,
          familyId: 9,
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
      items: [enrollment],
      total: 1,
      skip: 0,
      limit: 100,
    });
    vi.mocked(listPrograms).mockResolvedValue({
      items: [
        {
          id: 1,
          name: 'Expectant Mother',
          kind: 'PREGNANCY',
          subjectType: 'MOTHER',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: 30,
          active: true,
          sortOrder: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          name: 'Nutrition Child',
          kind: 'NUTRITION',
          subjectType: 'CHILD',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: 30,
          active: true,
          sortOrder: 2,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      total: 2,
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
    vi.mocked(fetchBirthingAssistants).mockResolvedValue([
      {
        id: 4,
        localId: null,
        name: 'Carmen Say',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(listVisits).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 3 });
  });

  it('renders the header with the derived site, midwife, family and children', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('María López')).toBeInTheDocument());

    expect(screen.getByText(/Xela \(.*: Quetzaltenango\)/)).toBeInTheDocument();
    expect(screen.getByText('5512-3344')).toBeInTheDocument();
    expect(await screen.findByText('Juana Ramírez')).toBeInTheDocument();
    expect(await screen.findByText('Familia López')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'José' })).toHaveAttribute('href', '/children/21');
    expect(fetchMother).toHaveBeenCalledWith(5);
  });

  it('shows the four mother counts', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('María López')).toBeInTheDocument());

    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('renders an enrollment card carrying the visit action, and none in the header', async () => {
    renderPage();

    const card = await screen.findByRole('link', { name: /Expectant Mother/ });
    expect(card).toHaveAttribute('href', '/enrollments/77');
    expect(screen.getByRole('link', { name: /enrollment.add_visit/ })).toHaveAttribute(
      'href',
      '/enrollments/77/visits/new'
    );
    expect(await screen.findByText('Carmen Say')).toBeInTheDocument();
    expect(listEnrollments).toHaveBeenCalledWith({ motherId: 5, limit: 100 });
  });

  it('routes + Enroll in program to the wizard with the mother pre-selected', async () => {
    renderPage();

    const picker = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'Expectant Mother' })).toBeInTheDocument()
    );
    expect(within(picker).queryByRole('option', { name: 'Nutrition Child' })).toBeNull();

    fireEvent.change(picker, { target: { value: '1' } });

    expect(mockNavigate).toHaveBeenCalledWith('/programs/1/enroll?motherId=5');
  });

  it('hides delete from caseworkers and soft-deletes for a supervisor', async () => {
    authState.role = 'CASEWORKER';
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.getByText('María López')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    unmount();

    authState.role = 'SUPERVISOR';
    vi.mocked(deleteMother).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText('María López')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteMother).toHaveBeenCalledWith(5));
  });

  it('shows an error when the mother fails to load', async () => {
    vi.mocked(fetchMother).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('mothers.load_failed')).toBeInTheDocument());
  });
});
