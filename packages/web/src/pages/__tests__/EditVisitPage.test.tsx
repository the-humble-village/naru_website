import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useParams } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VisitFormProps } from '../../components/VisitForm';
import EditVisitPage from '../visits/EditVisitPage';
import { visitsApi } from '../../api/visits';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { mothersApi } from '../../api/mothers';

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

vi.mock('../../api/visits', () => ({ visitsApi: { fetchVisit: vi.fn() } }));
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
        <button type="button" onClick={() => props.onSaved?.(props.visit!)}>
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
  answers: [],
  pregnancyDetail: { weight: 64.1, gestationMonths: 7, examinationTypeId: null },
};

const ENROLLMENT = {
  id: 12,
  localId: null,
  programId: 3,
  motherId: 8,
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
  createdAt: STAMP,
  updatedAt: STAMP,
};

const PROGRAM = {
  id: 3,
  name: 'Expectant Mother',
  kind: 'PREGNANCY' as const,
  subjectType: 'MOTHER' as const,
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const MOTHER = {
  id: 8,
  localId: null,
  name: 'Maria Lopez',
  birthDate: '1998-02-10',
  communityId: 2,
  familyId: null,
  midwifeId: null,
  phone: null,
  notes: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EditVisitPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('EditVisitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: '77' });
    (visitsApi.fetchVisit as ReturnType<typeof vi.fn>).mockResolvedValue(VISIT);
    (enrollmentsApi.fetchEnrollment as ReturnType<typeof vi.fn>).mockResolvedValue(ENROLLMENT);
    (programsApi.fetchProgram as ReturnType<typeof vi.fn>).mockResolvedValue(PROGRAM);
    (mothersApi.fetchMother as ReturnType<typeof vi.fn>).mockResolvedValue(MOTHER);
  });

  it('renders the edit header with the subject and program', async () => {
    renderPage();

    expect(await screen.findByText('← Maria Lopez · Expectant Mother')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'visit.edit_visit' })).toBeInTheDocument();
  });

  it('hands the loaded visit to VisitForm and never offers an enrollment selector', async () => {
    renderPage();

    await screen.findByTestId('visit-form');

    const props = mockVisitForm.mock.calls.at(-1)?.[0] as VisitFormProps;
    expect(props.visit).toEqual(VISIT);
    expect(props.enrollmentId).toBe(12);
    expect(props.program).toEqual({ id: 3, kind: 'PREGNANCY', name: 'Expectant Mother' });
    expect(props.subject).toBeNull();
    expect(screen.queryByLabelText(/enrollment/i)).not.toBeInTheDocument();
  });

  it('returns to the visit detail after saving', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('stub-save'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/visits/77'));
  });

  it('returns to the visit detail on cancel', async () => {
    renderPage();

    fireEvent.click(await screen.findByText('stub-cancel'));

    expect(mockNavigate).toHaveBeenCalledWith('/visits/77');
  });

  it('shows an error when the visit fails to load', async () => {
    (visitsApi.fetchVisit as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByText('visit.detail_load_failed')).toBeInTheDocument();
  });
});
