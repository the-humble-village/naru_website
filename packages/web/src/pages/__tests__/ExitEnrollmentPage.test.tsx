import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExitEnrollmentPage from '../enrollments/ExitEnrollmentPage';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: {
    fetchEnrollment: vi.fn(),
    exitEnrollment: vi.fn(),
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
const mockExitEnrollment = enrollmentsApi.exitEnrollment as ReturnType<typeof vi.fn>;
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

const enrollment = {
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
  admissionNotes: null,
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
    caretakerPhone: null,
    nutritionalStatus: 'MODERATE' as const,
  },
  studentDetail: null,
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/enrollments/42/exit']}>
        <Routes>
          <Route path="/enrollments/:id/exit" element={<ExitEnrollmentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ExitEnrollmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, login: 'u', email: null, firstName: 'A', lastName: 'B', role: 'CASEWORKER', lang: 'en' },
      lang: 'en',
    });
    mockFetchEnrollment.mockResolvedValue(enrollment);
    mockFetchProgram.mockResolvedValue(program);
    mockFetchChild.mockResolvedValue(child);
    mockListVisits.mockResolvedValue({ items: [], total: 18, skip: 0, limit: 100 });
    mockFetchCommunities.mockResolvedValue([]);
  });

  it('renders the header context and the summary block', async () => {
    renderPage();

    expect(await screen.findByText(/exit.enrolled/)).toBeInTheDocument();
    expect(await screen.findByText('2026-05-02')).toBeInTheDocument();
    expect(screen.getByText(/18/)).toBeInTheDocument();
    expect(screen.getByTestId('exit-summary')).toBeInTheDocument();
    expect(screen.getByText('nutritional_status.moderate')).toBeInTheDocument();
  });

  it('requires a reason and refuses to submit without one', async () => {
    renderPage();

    await screen.findByLabelText(/exit.exit_date/);
    fireEvent.click(screen.getByRole('button', { name: 'exit.submit' }));

    expect(await screen.findByText('exit.reason_required')).toBeInTheDocument();
    expect(mockExitEnrollment).not.toHaveBeenCalled();
  });

  it('refuses an exit date earlier than the admission date', async () => {
    renderPage();

    const dateInput = await screen.findByLabelText(/exit.exit_date/);
    fireEvent.change(dateInput, { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText(/exit.reason/), { target: { value: 'GRADUATED' } });
    fireEvent.click(screen.getByRole('button', { name: 'exit.submit' }));

    expect(await screen.findByText('exit.date_before_admission')).toBeInTheDocument();
    expect(mockExitEnrollment).not.toHaveBeenCalled();
  });

  it('exits the enrollment and tells the worker it can be undone', async () => {
    mockExitEnrollment.mockResolvedValue({ ...enrollment, exitedAt: '2026-09-20' });
    renderPage();

    const dateInput = await screen.findByLabelText(/exit.exit_date/);
    fireEvent.change(dateInput, { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText(/exit.reason/), { target: { value: 'GRADUATED' } });
    fireEvent.change(screen.getByLabelText('exit.exit_weight_kg'), { target: { value: '6.4' } });

    fireEvent.click(screen.getByRole('button', { name: 'exit.submit' }));

    await waitFor(() => expect(mockExitEnrollment).toHaveBeenCalledTimes(1));
    expect(mockExitEnrollment.mock.calls[0]![0]).toBe(42);
    expect(mockExitEnrollment.mock.calls[0]![1]).toMatchObject({
      exitedAt: '2026-09-20',
      exitReason: 'GRADUATED',
      exitWeight: 6.4,
    });

    expect(await screen.findByText('exit.success_undo_hint')).toBeInTheDocument();
  });

  it('asks for confirmation before recording a death', async () => {
    mockExitEnrollment.mockResolvedValue({ ...enrollment, exitedAt: '2026-09-20' });
    renderPage();

    const dateInput = await screen.findByLabelText(/exit.exit_date/);
    fireEvent.change(dateInput, { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByLabelText(/exit.reason/), { target: { value: 'DIED' } });
    fireEvent.click(screen.getByRole('button', { name: 'exit.submit' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(mockExitEnrollment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'exit.confirm_died_button' }));

    await waitFor(() => expect(mockExitEnrollment).toHaveBeenCalledTimes(1));
    expect(mockExitEnrollment.mock.calls[0]![1]).toMatchObject({ exitReason: 'DIED' });
  });
});
