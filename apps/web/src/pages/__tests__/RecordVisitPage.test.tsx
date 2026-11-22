import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useParams } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VisitFormProps } from '../../components/VisitForm';
import RecordVisitPage from '../visits/RecordVisitPage';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { childrenApi } from '../../api/children';

const { mockVisitForm, mockNavigate } = vi.hoisted(() => ({
  mockVisitForm: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: 'en' }),
  default: () => ({ t: (key: string) => key, lang: 'en' }),
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'CASEWORKER' }, lang: 'en' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: vi.fn(), useNavigate: () => mockNavigate };
});

vi.mock('../../api/enrollments', () => ({ enrollmentsApi: { fetchEnrollment: vi.fn() } }));
vi.mock('../../api/programs', () => ({ programsApi: { fetchProgram: vi.fn() } }));
vi.mock('../../api/children', () => ({ childrenApi: { fetchChild: vi.fn() } }));
vi.mock('../../api/mothers', () => ({ mothersApi: { fetchMother: vi.fn() } }));
vi.mock('../../api/people', () => ({ peopleApi: { fetchPerson: vi.fn() } }));
vi.mock('../../api/families', () => ({ familiesApi: { fetchFamily: vi.fn() } }));

vi.mock('../../components/VisitForm', () => {
  const Stub = (props: VisitFormProps) => {
    mockVisitForm(props);
    return (
      <div data-testid="visit-form">
        <button
          type="button"
          onClick={() =>
            props.onSaved?.({
              id: 99,
              localId: null,
              enrollmentId: props.enrollmentId,
              visitDate: '2026-09-29',
              locationType: 'SITE',
              siteId: null,
              communityId: null,
              recordedById: 1,
              eventId: null,
              notes: null,
              createdAt: '2026-09-29T00:00:00.000Z',
              updatedAt: '2026-09-29T00:00:00.000Z',
              resources: [],
              trainingIds: [],
              answers: [],
            })
          }
        >
          stub-save
        </button>
        <button type="button" onClick={() => props.onCancel?.()}>
          stub-cancel
        </button>
      </div>
    );
  };
  return { __esModule: true, default: Stub, VisitForm: Stub };
});

const STAMP = '2026-01-01T00:00:00.000Z';

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

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RecordVisitPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('RecordVisitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: '12' });
    (enrollmentsApi.fetchEnrollment as ReturnType<typeof vi.fn>).mockResolvedValue(ENROLLMENT);
    (programsApi.fetchProgram as ReturnType<typeof vi.fn>).mockResolvedValue(PROGRAM);
    (childrenApi.fetchChild as ReturnType<typeof vi.fn>).mockResolvedValue(CHILD);
  });

  it('renders the subject and program in the back link', async () => {
    renderPage();

    expect(await screen.findByText('← Jose Lopez · Nutrition')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'visit.record_visit' })).toBeInTheDocument();
  });

  it('passes the enrollment, program and child through to VisitForm', async () => {
    renderPage();

    await screen.findByTestId('visit-form');

    const props = mockVisitForm.mock.calls.at(-1)?.[0] as VisitFormProps;
    expect(props.enrollmentId).toBe(12);
    expect(props.program).toEqual({ id: 3, kind: 'NUTRITION', name: 'Nutrition' });
    expect(props.subject).toEqual({ birthDate: CHILD.birthDate, sex: 'MALE' });
    expect(props.visit).toBeUndefined();
  });

  it("navigates to the subject's profile after saving", async () => {
    renderPage();

    fireEvent.click(await screen.findByText('stub-save'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/children/5'));
  });

  it('returns to the subject on cancel', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('stub-cancel'));

    expect(mockNavigate).toHaveBeenCalledWith('/children/5');
  });

  it('shows an error when the enrollment fails to load', async () => {
    (enrollmentsApi.fetchEnrollment as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom')
    );
    renderPage();

    expect(await screen.findByText('visit.enrollment_load_failed')).toBeInTheDocument();
  });
});
