import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EnrollmentListItem, VisitListItem } from '@naru/shared';
import ChildDetailPage from '../children/ChildDetailPage';
import { fetchChild, updateChild, deleteChild } from '../../api/children';
import { fetchMother, listMothers } from '../../api/mothers';
import { fetchFamily } from '../../api/families';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import { listVisits } from '../../api/visits';

vi.mock('../../api/children', () => ({
  fetchChild: vi.fn(),
  updateChild: vi.fn(),
  deleteChild: vi.fn(),
}));
vi.mock('../../api/mothers', () => ({ fetchMother: vi.fn(), listMothers: vi.fn() }));
vi.mock('../../api/families', () => ({ fetchFamily: vi.fn() }));
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
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: '2' }) };
});

const child = {
  id: 2,
  localId: null,
  name: 'José Ramírez',
  birthDate: '2026-05-01T00:00:00.000Z',
  sex: 'MALE' as const,
  communityId: 3,
  motherId: 5,
  familyId: 9,
  notes: 'Healthy development',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const nutritionEnrollment: EnrollmentListItem = {
  id: 44,
  localId: null,
  programId: 2,
  motherId: null,
  childId: 2,
  personId: null,
  familyId: null,
  enrolledAt: '2026-06-01',
  entryWeight: 5.2,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  nutritionDetail: {
    lengthAtAdmission: 560,
    caretakerName: 'Abuela',
    caretakerPhone: null,
    nutritionalStatus: 'MODERATE',
  },
  program: { id: 2, name: 'Nutrition Infant', kind: 'NUTRITION', subjectType: 'CHILD' },
  subjectName: 'José Ramírez',
  visitCount: 3,
  lastVisitDate: '2026-08-01',
};

const visit = (id: number, date: string, weight: number, z: number): VisitListItem => ({
  id,
  localId: null,
  enrollmentId: 44,
  visitDate: date,
  locationType: 'SITE',
  siteId: 8,
  communityId: 3,
  recordedById: 1,
  eventId: null,
  notes: null,
  createdAt: `${date}T00:00:00.000Z`,
  updatedAt: `${date}T00:00:00.000Z`,
  resources: [],
  trainingIds: [],
  answers: [],
  nutritionDetail: {
    weight,
    height: null,
    armCircumference: null,
    weightForAgeZ: z,
    heightForAgeZ: null,
    weightForHeightZ: null,
    muacZ: null,
    nutritionalStatus: 'MODERATE',
  },
  program: { id: 2, name: 'Nutrition Infant', kind: 'NUTRITION', subjectType: 'CHILD' },
  subjectName: 'José Ramírez',
  recordedByName: 'Worker',
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChildDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ChildDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = 'SUPERVISOR';
    vi.mocked(fetchChild).mockResolvedValue(child);
    vi.mocked(fetchMother).mockResolvedValue({
      id: 5,
      localId: null,
      name: 'María López',
      birthDate: null,
      communityId: 3,
      phone: null,
      familyId: 9,
      midwifeId: null,
      pregnancies: null,
      childrenCount: null,
      breastfedCount: null,
      malnutritionDeaths: null,
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
    vi.mocked(listEnrollments).mockResolvedValue({
      items: [nutritionEnrollment],
      total: 1,
      skip: 0,
      limit: 100,
    });
    vi.mocked(listPrograms).mockResolvedValue({
      items: [
        {
          id: 2,
          name: 'Nutrition Infant',
          kind: 'NUTRITION',
          subjectType: 'CHILD',
          description: null,
          minAgeMonths: null,
          maxAgeMonths: null,
          visitIntervalDays: 30,
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
    vi.mocked(listVisits).mockResolvedValue({
      items: [visit(1, '2026-06-10', 5.4, -2.1), visit(2, '2026-07-10', 5.9, -1.8)],
      total: 2,
      skip: 0,
      limit: 100,
    });
    vi.mocked(listMothers).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 10 });
  });

  it('renders the header with sex, derived site, mother and family links', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('José Ramírez')).toBeInTheDocument());

    expect(screen.getByText(/Xela \(.*: Quetzaltenango\)/)).toBeInTheDocument();
    expect(screen.getByText('Healthy development')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'María López' })).toHaveAttribute(
      'href',
      '/mothers/5'
    );
    expect(await screen.findByRole('link', { name: 'Familia López' })).toHaveAttribute(
      'href',
      '/families/9'
    );
    expect(fetchChild).toHaveBeenCalledWith(2);
  });

  it('renders the nutrition weight trend from persisted visit values', async () => {
    renderPage();

    const chart = await screen.findByRole('img', { name: 'profile.weight_trend' });
    const trend = chart.closest('div')?.parentElement as HTMLElement;

    expect(within(trend).getByText('5.4 kg')).toBeInTheDocument();
    expect(within(trend).getByText('5.9 kg')).toBeInTheDocument();
    expect(within(trend).getByText(/-1\.80/)).toBeInTheDocument();
  });

  it('prompts to link a mother when none is set and saves the pick', async () => {
    vi.mocked(fetchChild).mockResolvedValue({ ...child, motherId: null });
    vi.mocked(listMothers).mockResolvedValue({
      items: [
        {
          id: 7,
          localId: null,
          name: 'Ana Pérez',
          birthDate: null,
          communityId: null,
          phone: null,
          familyId: null,
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
      limit: 10,
    });
    vi.mocked(updateChild).mockResolvedValue({ ...child, motherId: 7 });

    renderPage();

    const search = await screen.findByLabelText('children.link_mother');
    expect(screen.getByText(/children\.no_mother/)).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'Ana' } });

    const option = await screen.findByRole('button', { name: 'Ana Pérez' }, { timeout: 3000 });
    fireEvent.click(option);

    await waitFor(() => expect(updateChild).toHaveBeenCalledWith(2, { motherId: 7 }));
  });

  it('keeps the visit action on the enrollment card, never the page header', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('José Ramírez')).toBeInTheDocument());

    const visitLinks = await screen.findAllByRole('link', { name: /enrollment\.add_visit/ });
    expect(visitLinks).toHaveLength(1);
    expect(visitLinks[0]).toHaveAttribute('href', '/enrollments/44/visits/new');
  });

  it('routes + Enroll in program to the wizard with the child pre-selected', async () => {
    renderPage();

    const picker = await screen.findByRole('combobox');
    await waitFor(() =>
      expect(within(picker).getByRole('option', { name: 'Nutrition Infant' })).toBeInTheDocument()
    );

    fireEvent.change(picker, { target: { value: '2' } });
    expect(mockNavigate).toHaveBeenCalledWith('/programs/2/enroll?childId=2');
  });

  it('hides delete from caseworkers and soft-deletes for a supervisor', async () => {
    authState.role = 'CASEWORKER';
    const { unmount } = renderPage();
    await waitFor(() => expect(screen.getByText('José Ramírez')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    unmount();

    authState.role = 'SUPERVISOR';
    vi.mocked(deleteChild).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => expect(screen.getByText('José Ramírez')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteChild).toHaveBeenCalledWith(2));
  });

  it('shows an error when the child fails to load', async () => {
    vi.mocked(fetchChild).mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load child.')).toBeInTheDocument());
  });
});
