import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useParams } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import VisitDetailPage from '../visits/VisitDetailPage';
import { visitsApi } from '../../api/visits';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { photosApi } from '../../api/photos';
import { questionsApi } from '../../api/questions';
import { useAuthStore } from '../../store/auth';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({ useAuthStore: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: vi.fn(), useNavigate: () => mockNavigate };
});

vi.mock('../../api/visits', () => ({
  visitsApi: { fetchVisit: vi.fn(), listVisits: vi.fn(), deleteVisit: vi.fn() },
}));
vi.mock('../../api/enrollments', () => ({ enrollmentsApi: { fetchEnrollment: vi.fn() } }));
vi.mock('../../api/programs', () => ({ programsApi: { fetchProgram: vi.fn() } }));
vi.mock('../../api/children', () => ({ childrenApi: { fetchChild: vi.fn() } }));
vi.mock('../../api/mothers', () => ({ mothersApi: { fetchMother: vi.fn() } }));
vi.mock('../../api/people', () => ({ peopleApi: { fetchPerson: vi.fn() } }));
vi.mock('../../api/families', () => ({ familiesApi: { fetchFamily: vi.fn() } }));
vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchSites: vi.fn(),
    fetchCommunities: vi.fn(),
    fetchResources: vi.fn(),
    fetchTraining: vi.fn(),
    fetchExaminationTypes: vi.fn(),
  },
}));
vi.mock('../../api/photos', () => ({ photosApi: { listPhotos: vi.fn() } }));
vi.mock('../../api/questions', () => ({ questionsApi: { listQuestions: vi.fn() } }));

const STAMP = '2026-01-01T00:00:00.000Z';

const lookup = (id: number, title: string) => ({
  id,
  title,
  sortOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
});

const VISIT = {
  id: 77,
  localId: null,
  enrollmentId: 12,
  visitDate: '2026-09-04',
  locationType: 'HOME' as const,
  siteId: 1,
  communityId: 2,
  recordedById: 4,
  eventId: null,
  notes: 'Doing better',
  createdAt: STAMP,
  updatedAt: STAMP,
  resources: [{ resourceId: 7, quantity: 2, unit: 'bag' }],
  trainingIds: [9],
  answers: [{ questionId: 30, valueText: null, valueNum: 3, valueBool: null }],
  nutritionDetail: {
    weight: 6.5,
    height: 620,
    armCircumference: 118,
    weightForAgeZ: -2.4,
    heightForAgeZ: null,
    weightForHeightZ: null,
    muacZ: -2.1,
    nutritionalStatus: 'MODERATE' as const,
  },
};

const ENROLLMENT = {
  id: 12,
  localId: null,
  programId: 3,
  motherId: null,
  childId: 5,
  personId: null,
  familyId: null,
  enrolledAt: '2026-04-02',
  entryWeight: 3.2,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const PROGRAM = {
  id: 3,
  name: 'Nutrition',
  kind: 'NUTRITION' as const,
  subjectType: 'CHILD' as const,
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const CHILD = {
  id: 5,
  localId: null,
  name: 'Jose Lopez',
  birthDate: '2026-03-01T00:00:00.000Z',
  sex: 'MALE' as const,
  communityId: 2,
  motherId: 7,
  familyId: null,
  notes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const setRole = (role: 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER') => {
  mockUseAuthStore.mockReturnValue({ user: { id: 1, role }, lang: 'en' });
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VisitDetailPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('VisitDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('CASEWORKER');
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: '77' });
    (visitsApi.fetchVisit as ReturnType<typeof vi.fn>).mockResolvedValue(VISIT);
    (visitsApi.listVisits as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{ ...VISIT, program: PROGRAM, subjectName: 'Jose Lopez', recordedByName: 'Ana Perez' }],
      total: 1,
      skip: 0,
      limit: 100,
    });
    (visitsApi.deleteVisit as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (enrollmentsApi.fetchEnrollment as ReturnType<typeof vi.fn>).mockResolvedValue(ENROLLMENT);
    (programsApi.fetchProgram as ReturnType<typeof vi.fn>).mockResolvedValue(PROGRAM);
    (childrenApi.fetchChild as ReturnType<typeof vi.fn>).mockResolvedValue(CHILD);
    (adminApi.fetchSites as ReturnType<typeof vi.fn>).mockResolvedValue([
      lookup(1, 'Quetzaltenango'),
    ]);
    (adminApi.fetchCommunities as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...lookup(2, 'Xela'), siteId: 1 },
    ]);
    (adminApi.fetchResources as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...lookup(7, 'Incaparina'), defaultUnit: 'bag' },
    ]);
    (adminApi.fetchTraining as ReturnType<typeof vi.fn>).mockResolvedValue([
      lookup(9, 'Nutrition basics'),
    ]);
    (adminApi.fetchExaminationTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (photosApi.listPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 50,
    });
    (questionsApi.listQuestions as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 30,
        title: 'How many meals per day?',
        answerType: 'NUMBER',
        choices: null,
        sortOrder: 0,
        createdAt: STAMP,
        updatedAt: STAMP,
      },
    ]);
  });

  it('renders the spine, the nutrition detail, resources, trainings and answers', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '4/9/2026' })).toBeInTheDocument();
    expect(screen.getByText('Doing better')).toBeInTheDocument();
    expect(await screen.findByText('Quetzaltenango')).toBeInTheDocument();
    expect(screen.getByText('Xela')).toBeInTheDocument();
    expect(await screen.findByText('Ana Perez')).toBeInTheDocument();
    expect(screen.getByText('nutrition.moderate')).toBeInTheDocument();
    expect(await screen.findByText(/Incaparina/)).toBeInTheDocument();
    expect(await screen.findByText('Nutrition basics')).toBeInTheDocument();
    expect(await screen.findByText('How many meals per day?')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('links back to the enrollment and out to the subject', async () => {
    renderPage();

    expect(await screen.findByText('← Jose Lopez · Nutrition')).toBeInTheDocument();
    const subjectLink = await screen.findByRole('link', { name: 'Jose Lopez' });
    expect(subjectLink).toHaveAttribute('href', '/children/5');
    expect(screen.getByRole('link', { name: 'common.edit' })).toHaveAttribute(
      'href',
      '/visits/77/edit'
    );
  });

  it('hides delete from a caseworker', async () => {
    renderPage();

    await screen.findByRole('heading', { name: '4/9/2026' });
    expect(screen.queryByRole('button', { name: 'common.delete' })).not.toBeInTheDocument();
  });

  it('lets a supervisor soft-delete the visit', async () => {
    setRole('SUPERVISOR');
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'common.delete' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.delete' }));

    await waitFor(() => expect(visitsApi.deleteVisit).toHaveBeenCalledWith(77));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/enrollments/12'));
  });

  it('shows an error when the visit fails to load', async () => {
    (visitsApi.fetchVisit as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('visit.detail_load_failed')).toBeInTheDocument();
  });
});
