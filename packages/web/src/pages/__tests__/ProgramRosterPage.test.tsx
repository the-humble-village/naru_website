import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProgramRosterPage } from '../programs/ProgramRosterPage';
import { programsApi } from '../../api/programs';
import { enrollmentsApi } from '../../api/enrollments';
import { visitsApi } from '../../api/visits';
import { childrenApi } from '../../api/children';
import { adminApi } from '../../api/admin';
import type { ChildRead, EnrollmentListItem, ProgramRead, VisitListItem } from '@naru/shared';

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    deleteProgram: vi.fn(),
  },
}));

vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: {
    listEnrollments: vi.fn(),
    fetchEnrollment: vi.fn(),
    createEnrollment: vi.fn(),
    updateEnrollment: vi.fn(),
    exitEnrollment: vi.fn(),
    reopenEnrollment: vi.fn(),
    deleteEnrollment: vi.fn(),
  },
}));

vi.mock('../../api/visits', () => ({
  visitsApi: {
    listVisits: vi.fn(),
    fetchVisitPrefill: vi.fn(),
    fetchVisit: vi.fn(),
    createVisit: vi.fn(),
    updateVisit: vi.fn(),
    deleteVisit: vi.fn(),
  },
}));

vi.mock('../../api/children', () => ({
  childrenApi: {
    listChildren: vi.fn(),
    fetchChild: vi.fn(),
    createChild: vi.fn(),
    updateChild: vi.fn(),
    deleteChild: vi.fn(),
  },
}));

vi.mock('../../api/mothers', () => ({
  mothersApi: { listMothers: vi.fn(), fetchMother: vi.fn() },
}));

vi.mock('../../api/people', () => ({
  peopleApi: { listPeople: vi.fn(), fetchPerson: vi.fn() },
}));

vi.mock('../../api/families', () => ({
  familiesApi: { listFamilies: vi.fn(), fetchFamily: vi.fn() },
}));

vi.mock('../../api/admin', () => ({
  adminApi: {
    fetchCommunities: vi.fn(),
    fetchSites: vi.fn(),
    fetchLookupTable: vi.fn(),
  },
}));

vi.mock('../../hooks/useTranslation', async () => {
  const { t } = await import('@naru/shared');
  return {
    useTranslation: () => ({
      t: (key: Parameters<typeof t>[0]) => t(key, 'en'),
      lang: 'en',
    }),
  };
});

const MS_PER_DAY = 86_400_000;

const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);

const monthStart = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const nutritionProgram: ProgramRead = {
  id: 7,
  name: 'Nutrition Infant',
  kind: 'NUTRITION',
  subjectType: 'CHILD',
  description: null,
  minAgeMonths: null,
  maxAgeMonths: 24,
  visitIntervalDays: 30,
  active: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const enrollmentBase = {
  localId: null,
  programId: 7,
  motherId: null,
  personId: null,
  familyId: null,
  entryWeight: 8,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  program: {
    id: 7,
    name: 'Nutrition Infant',
    kind: 'NUTRITION' as const,
    subjectType: 'CHILD' as const,
  },
  visitCount: 1,
  pregnancyDetail: null,
  nutritionDetail: null,
  studentDetail: null,
};

// Five active (two overdue, one admitted this month) and three exited this
// month, so the four stats read 5 / 1 / 3 / 2 and cannot be confused.
const enrollments: EnrollmentListItem[] = [
  {
    ...enrollmentBase,
    id: 1,
    childId: 1,
    subjectName: 'Pedro Vasquez',
    enrolledAt: '2024-02-01',
    lastVisitDate: isoDaysAgo(60),
  },
  {
    ...enrollmentBase,
    id: 2,
    childId: 2,
    subjectName: 'Ana Morales',
    enrolledAt: '2024-02-01',
    lastVisitDate: isoDaysAgo(45),
  },
  {
    ...enrollmentBase,
    id: 3,
    childId: 3,
    subjectName: 'Rosa Tzul',
    enrolledAt: '2024-02-01',
    lastVisitDate: isoDaysAgo(4),
  },
  {
    ...enrollmentBase,
    id: 4,
    childId: 4,
    subjectName: 'Maria Lopez',
    enrolledAt: '2024-02-01',
    lastVisitDate: isoDaysAgo(9),
  },
  {
    ...enrollmentBase,
    id: 5,
    childId: 5,
    subjectName: 'Juana Coc',
    enrolledAt: monthStart(),
    lastVisitDate: isoDaysAgo(2),
  },
  {
    ...enrollmentBase,
    id: 6,
    childId: 6,
    subjectName: 'Exited One',
    enrolledAt: '2024-02-01',
    exitedAt: monthStart(),
    exitReason: 'GRADUATED',
    exitWeight: 11,
    lastVisitDate: isoDaysAgo(40),
  },
  {
    ...enrollmentBase,
    id: 7,
    childId: 7,
    subjectName: 'Exited Two',
    enrolledAt: '2024-02-01',
    exitedAt: monthStart(),
    exitReason: 'MOVED_AWAY',
    lastVisitDate: isoDaysAgo(40),
  },
  {
    ...enrollmentBase,
    id: 8,
    childId: 8,
    subjectName: 'Exited Three',
    enrolledAt: '2024-02-01',
    exitedAt: monthStart(),
    exitReason: 'WITHDREW',
    lastVisitDate: isoDaysAgo(40),
  },
];

const children: ChildRead[] = enrollments.map((enrollment, index) => ({
  id: enrollment.childId as number,
  localId: null,
  name: enrollment.subjectName ?? '',
  birthDate: '2025-01-01T00:00:00Z',
  sex: index % 2 === 0 ? 'MALE' : 'FEMALE',
  communityId: 1,
  motherId: null,
  familyId: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}));

const visits: VisitListItem[] = [
  {
    id: 100,
    localId: null,
    enrollmentId: 1,
    visitDate: isoDaysAgo(60),
    locationType: 'HOME',
    siteId: null,
    communityId: 1,
    recordedById: null,
    eventId: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resources: [],
    trainingIds: [],
    answers: [],
    pregnancyDetail: null,
    nutritionDetail: {
      weight: 6.2,
      height: null,
      armCircumference: null,
      weightForAgeZ: -3.4,
      heightForAgeZ: null,
      weightForHeightZ: null,
      muacZ: null,
      nutritionalStatus: 'SEVERE',
    },
    program: {
      id: 7,
      name: 'Nutrition Infant',
      kind: 'NUTRITION',
      subjectType: 'CHILD',
    },
    subjectName: 'Pedro Vasquez',
    recordedByName: null,
  },
];

const renderPage = (initialPath = '/programs/7') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/programs/:id" element={<ProgramRosterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const statValue = (label: string): string => {
  const node = screen.getByText(label);
  return node.parentElement?.textContent ?? '';
};

describe('ProgramRosterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(programsApi.fetchProgram).mockResolvedValue(nutritionProgram);
    vi.mocked(enrollmentsApi.listEnrollments).mockResolvedValue({
      items: enrollments,
      total: enrollments.length,
      skip: 0,
      limit: 100,
    });
    vi.mocked(childrenApi.listChildren).mockResolvedValue({
      items: children,
      total: children.length,
      skip: 0,
      limit: 100,
    });
    vi.mocked(visitsApi.listVisits).mockResolvedValue({
      items: visits,
      total: visits.length,
      skip: 0,
      limit: 100,
    });
    vi.mocked(adminApi.fetchCommunities).mockResolvedValue([
      { id: 1, title: 'Xela', siteId: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
    vi.mocked(adminApi.fetchSites).mockResolvedValue([
      { id: 1, title: 'Highlands', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ]);
  });

  it('renders the program name, the enroll action and the active roster', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nutrition Infant' })).toBeInTheDocument();
    });

    expect(screen.getByText('roster.enroll').closest('a')).toHaveAttribute(
      'href',
      '/programs/7/enroll'
    );

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Vasquez').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Juana Coc').length).toBeGreaterThan(0);
    expect(screen.queryByText('Exited One')).not.toBeInTheDocument();
  });

  it('computes the four roster stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Vasquez').length).toBeGreaterThan(0);
    });

    expect(statValue('roster.stat_active')).toContain('5');
    expect(statValue('roster.stat_new_this_month')).toContain('1');
    expect(statValue('roster.stat_exited_this_month')).toContain('3');
    expect(statValue('roster.stat_overdue')).toContain('2');
  });

  it('hides the overdue stat for a program with no visit interval', async () => {
    vi.mocked(programsApi.fetchProgram).mockResolvedValue({
      ...nutritionProgram,
      visitIntervalDays: null,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('roster.stat_active')).toBeInTheDocument();
    });

    expect(screen.queryByText('roster.stat_overdue')).not.toBeInTheDocument();
  });

  it('filters the roster by the search box and keeps it in the query string', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Vasquez').length).toBeGreaterThan(0);
    });

    await user.type(screen.getByLabelText('roster.search'), 'Ana');

    await waitFor(() => {
      expect(screen.queryByText('Pedro Vasquez')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Ana Morales').length).toBeGreaterThan(0);
  });

  it('reads the tab from the query string and swaps to the exited variant', async () => {
    renderPage('/programs/7?tab=exited');

    await waitFor(() => {
      expect(screen.getAllByText('Exited One').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Pedro Vasquez')).not.toBeInTheDocument();
    expect(screen.getAllByText('exit_reason.graduated').length).toBeGreaterThan(0);
  });

  it('shows the persisted nutritional status from the latest visit', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('nutritional_status.severe').length).toBeGreaterThan(0);
    });
  });
});
