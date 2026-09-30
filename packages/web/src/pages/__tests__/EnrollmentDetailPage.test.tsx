import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EnrollmentDetailPage from '../enrollments/EnrollmentDetailPage';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: {
    fetchEnrollment: vi.fn(),
    updateEnrollment: vi.fn(),
    reopenEnrollment: vi.fn(),
  },
  listEnrollments: vi.fn(),
}));

vi.mock('../../api/programs', () => ({
  programsApi: { fetchProgram: vi.fn() },
  listPrograms: vi.fn(),
}));

vi.mock('../../api/visits', () => ({
  visitsApi: { listVisits: vi.fn() },
  listVisits: vi.fn(),
}));

vi.mock('../../api/children', () => ({
  childrenApi: { fetchChild: vi.fn() },
  listChildren: vi.fn(),
  createChild: vi.fn(),
}));

vi.mock('../../api/mothers', () => ({
  mothersApi: { fetchMother: vi.fn() },
  listMothers: vi.fn(),
  createMother: vi.fn(),
}));

vi.mock('../../api/people', () => ({
  peopleApi: { fetchPerson: vi.fn() },
  listPeople: vi.fn(),
  createPerson: vi.fn(),
}));

vi.mock('../../api/families', () => ({
  familiesApi: { fetchFamily: vi.fn() },
  listFamilies: vi.fn(),
  createFamily: vi.fn(),
}));

vi.mock('../../api/birthing-assistants', () => ({
  birthingAssistantsApi: { fetchBirthingAssistants: vi.fn() },
}));

vi.mock('../../api/admin', () => ({
  adminApi: { fetchCommunities: vi.fn() },
}));

vi.mock('../../api/files', () => ({
  filesApi: {
    getPresignedDownloadUrls: vi.fn(),
    requestPresignedUpload: vi.fn(),
    uploadFileToS3: vi.fn(),
    confirmUpload: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

vi.mock('../../store/auth', () => ({ useAuthStore: vi.fn() }));

const mockFetchEnrollment = enrollmentsApi.fetchEnrollment as ReturnType<typeof vi.fn>;
const mockUpdateEnrollment = enrollmentsApi.updateEnrollment as ReturnType<typeof vi.fn>;
const mockFetchProgram = programsApi.fetchProgram as ReturnType<typeof vi.fn>;
const mockListVisits = visitsApi.listVisits as ReturnType<typeof vi.fn>;
const mockFetchChild = childrenApi.fetchChild as ReturnType<typeof vi.fn>;
const mockFetchCommunities = adminApi.fetchCommunities as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const program = {
  id: 1,
  name: 'Nutrition Infant',
  kind: 'NUTRITION' as const,
  subjectType: 'CHILD' as const,
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const child = {
  id: 5,
  localId: null,
  name: 'Ana Lopez',
  birthDate: '2026-01-01T00:00:00.000Z',
  sex: 'FEMALE' as const,
  communityId: null,
  motherId: null,
  familyId: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const activeEnrollment = {
  id: 42,
  localId: null,
  programId: 1,
  motherId: null,
  childId: 5,
  personId: null,
  familyId: null,
  enrolledAt: '2026-05-02',
  entryWeight: 3.1,
  entryPhotoId: null,
  admissionNotes: 'Referred by the clinic',
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2026-05-02T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
  pregnancyDetail: null,
  nutritionDetail: {
    lengthAtAdmission: 540,
    caretakerName: 'Juana',
    caretakerPhone: '5512-3344',
    nutritionalStatus: 'MODERATE' as const,
  },
  studentDetail: null,
};

const visit = {
  id: 7,
  localId: null,
  enrollmentId: 42,
  visitDate: '2026-06-01',
  locationType: 'SITE' as const,
  siteId: null,
  communityId: null,
  eventId: null,
  notes: null,
  recordedById: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  resources: [],
  trainingIds: [],
  answers: [],
  pregnancyDetail: null,
  nutritionDetail: {
    weight: 3.6,
    height: null,
    armCircumference: null,
    weightForAgeZ: null,
    heightForAgeZ: null,
    weightForHeightZ: null,
    muacZ: null,
    nutritionalStatus: 'MODERATE' as const,
  },
  program: { id: 1, name: 'Nutrition Infant', kind: 'NUTRITION', subjectType: 'CHILD' },
  subjectName: 'Ana Lopez',
  recordedByName: 'Caseworker',
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/enrollments/42']}>
        <Routes>
          <Route path="/enrollments/:id" element={<EnrollmentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EnrollmentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, login: 'u', email: null, firstName: 'A', lastName: 'B', role: 'SUPERVISOR', lang: 'en' },
      lang: 'en',
    });
    mockFetchEnrollment.mockResolvedValue(activeEnrollment);
    mockFetchProgram.mockResolvedValue(program);
    mockFetchChild.mockResolvedValue(child);
    mockListVisits.mockResolvedValue({ items: [visit], total: 1, skip: 0, limit: 100 });
    mockFetchCommunities.mockResolvedValue([]);
  });

  it('renders the spine: program, subject, admission and the visit list', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Nutrition Infant' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ana Lopez' })).toBeInTheDocument();
    expect(screen.getByText('2026-05-02')).toBeInTheDocument();
    expect(screen.getByText('enrollment.active')).toBeInTheDocument();

    expect(await screen.findByText('2026-06-01')).toBeInTheDocument();
    const addVisit = screen.getAllByRole('link', { name: 'enrollment.add_visit' })[0];
    expect(addVisit).toHaveAttribute('href', '/enrollments/42/visits/new');
    expect(screen.getByRole('link', { name: 'enrollment.exit' })).toHaveAttribute(
      'href',
      '/enrollments/42/exit'
    );
  });

  it('renders the program and subject read-only — there is no control to change them', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Nutrition Infant' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByLabelText(/enroll.admission_date/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/enroll.program/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/enroll.subject/)).not.toBeInTheDocument();
  });

  it('saves edited admission fields through updateEnrollment', async () => {
    mockUpdateEnrollment.mockResolvedValue({ ...activeEnrollment, entryWeight: 3.4 });
    renderPage();

    await screen.findByRole('heading', { name: 'Nutrition Infant' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const weight = await screen.findByLabelText('enroll.entry_weight_kg');
    fireEvent.change(weight, { target: { value: '3.4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdateEnrollment).toHaveBeenCalledTimes(1));
    expect(mockUpdateEnrollment.mock.calls[0]![0]).toBe(42);
    expect(mockUpdateEnrollment.mock.calls[0]![1]).toMatchObject({
      enrolledAt: '2026-05-02',
      entryWeight: 3.4,
    });
  });

  it('shows the exit summary and a supervisor reopen action once exited', async () => {
    mockFetchEnrollment.mockResolvedValue({
      ...activeEnrollment,
      exitedAt: '2026-09-20',
      exitReason: 'GRADUATED',
      exitWeight: 6.4,
      exitNotes: 'Discharged well',
    });

    renderPage();

    expect((await screen.findAllByText('exit_reason.graduated'))[0]).toBeInTheDocument();
    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
    expect(screen.getByText('Discharged well')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'enrollment.reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'enrollment.exit' })).not.toBeInTheDocument();
  });
});
