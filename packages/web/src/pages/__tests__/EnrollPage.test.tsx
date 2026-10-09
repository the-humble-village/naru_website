import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EnrollPage from '../enrollments/EnrollPage';
import { programsApi } from '../../api/programs';
import { enrollmentsApi, listEnrollments } from '../../api/enrollments';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import { useAuthStore } from '../../store/auth';

vi.mock('../../api/programs', () => ({
  programsApi: { fetchProgram: vi.fn(), listPrograms: vi.fn() },
  listPrograms: vi.fn(),
  fetchProgram: vi.fn(),
}));

vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: { createEnrollment: vi.fn(), fetchEnrollment: vi.fn() },
  listEnrollments: vi.fn(),
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

const mockFetchProgram = programsApi.fetchProgram as ReturnType<typeof vi.fn>;
const mockCreateEnrollment = enrollmentsApi.createEnrollment as ReturnType<typeof vi.fn>;
const mockFetchChild = childrenApi.fetchChild as ReturnType<typeof vi.fn>;
const mockListEnrollments = listEnrollments as unknown as ReturnType<typeof vi.fn>;
const mockFetchCommunities = adminApi.fetchCommunities as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as unknown as ReturnType<typeof vi.fn>;

const nutritionProgram = {
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
  birthDate: '2026-05-01T00:00:00.000Z',
  sex: 'FEMALE' as const,
  communityId: null,
  motherId: null,
  familyId: null,
  notes: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

const renderPage = (entry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/programs/:id/enroll" element={<EnrollPage />} />
          <Route path="/enrollments/:id" element={<div>enrollment-detail-route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EnrollPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, login: 'u', email: null, firstName: 'A', lastName: 'B', role: 'CASEWORKER', lang: 'en' },
      lang: 'en',
    });
    mockFetchProgram.mockResolvedValue(nutritionProgram);
    mockFetchChild.mockResolvedValue(child);
    mockListEnrollments.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 50 });
    mockFetchCommunities.mockResolvedValue([]);
  });

  it('opens on step 1 with the subject picker when no subject is in the query string', async () => {
    renderPage('/programs/1/enroll');

    expect(await screen.findByText(/enroll.step_1_of_2/)).toBeInTheDocument();
    expect(screen.getByLabelText('subject_picker.search')).toBeInTheDocument();
    expect(mockFetchChild).not.toHaveBeenCalled();
  });

  it('skips step 1 and opens on step 2 when the subject arrives in the query string', async () => {
    renderPage('/programs/1/enroll?childId=5');

    expect(await screen.findByText(/enroll.step_2_of_2/)).toBeInTheDocument();
    expect(await screen.findByText('Ana Lopez')).toBeInTheDocument();
    expect(screen.getByLabelText(/enroll.admission_date/)).toBeInTheDocument();
    expect(mockFetchChild).toHaveBeenCalledWith(5);
  });

  it('ignores a subject param whose key does not match the program subject type', async () => {
    renderPage('/programs/1/enroll?motherId=9');

    expect(await screen.findByText(/enroll.step_1_of_2/)).toBeInTheDocument();
    expect(screen.getByLabelText('subject_picker.search')).toBeInTheDocument();
  });

  it('renders the nutrition block and computes the status live', async () => {
    renderPage('/programs/1/enroll?childId=5');

    const admissionDate = await screen.findByLabelText(/enroll.admission_date/);
    fireEvent.change(admissionDate, { target: { value: '2026-09-01' } });

    fireEvent.change(screen.getByLabelText('enroll.entry_weight_kg'), {
      target: { value: '3.1' },
    });

    expect(screen.getByLabelText('enroll.length_mm')).toBeInTheDocument();
    expect(screen.getByLabelText('enrollment.caretaker')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('live-nutritional-status')).toBeInTheDocument();
    });
  });

  it('submits the admission with the subject FK the program expects', async () => {
    mockCreateEnrollment.mockResolvedValue({ id: 42 });
    renderPage('/programs/1/enroll?childId=5');

    const admissionDate = await screen.findByLabelText(/enroll.admission_date/);
    fireEvent.change(admissionDate, { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('enroll.entry_weight_kg'), {
      target: { value: '3.1' },
    });
    fireEvent.change(screen.getByLabelText('enrollment.caretaker'), {
      target: { value: 'Juana' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'enroll.submit' }));

    await waitFor(() => expect(mockCreateEnrollment).toHaveBeenCalledTimes(1));

    const payload = mockCreateEnrollment.mock.calls[0]![0];
    expect(payload).toMatchObject({
      programId: 1,
      childId: 5,
      motherId: null,
      personId: null,
      familyId: null,
      enrolledAt: '2026-09-01',
      entryWeight: 3.1,
    });
    expect(payload.nutritionDetail).toMatchObject({ caretakerName: 'Juana' });
    expect(payload.pregnancyDetail).toBeUndefined();
    expect(payload.studentDetail).toBeUndefined();

    expect(await screen.findByText('enrollment-detail-route')).toBeInTheDocument();
  });
});
