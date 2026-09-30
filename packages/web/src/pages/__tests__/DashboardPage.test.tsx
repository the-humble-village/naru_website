import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DashboardPage } from '../DashboardPage';
import { dashboardApi } from '../../api/dashboard';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { visitsApi } from '../../api/visits';
import { reportsApi } from '../../api/reports';
import type {
  DashboardResponse,
  EnrollmentListItem,
  ProgramRead,
  ReportResponse,
  VisitListItem,
} from '@naru/shared';

vi.mock('../../api/dashboard', () => ({
  dashboardApi: {
    fetchDashboardData: vi.fn(),
    fetchUnenrolledCount: vi.fn(),
  },
}));

vi.mock('../../api/enrollments', () => ({
  enrollmentsApi: {
    listEnrollments: vi.fn(),
    fetchEnrollment: vi.fn(),
  },
}));

vi.mock('../../api/programs', () => ({
  programsApi: {
    listPrograms: vi.fn(),
    fetchProgram: vi.fn(),
  },
}));

vi.mock('../../api/visits', () => ({
  visitsApi: {
    listVisits: vi.fn(),
    fetchVisit: vi.fn(),
  },
}));

vi.mock('../../api/reports', () => ({
  reportsApi: {
    listReports: vi.fn(),
    fetchReport: vi.fn(),
    exportReport: vi.fn(),
    downloadReport: vi.fn(),
  },
}));

vi.mock('../../store/auth', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      login: 'caleb',
      email: null,
      firstName: 'Caleb',
      lastName: 'Rowley',
      role: 'ADMIN',
      lang: 'en',
    },
  }),
}));

// Keys the dictionaries do not carry yet resolve to themselves; the two
// interpolated strings are supplied so the counts they carry can be asserted.
const EXTRA: Record<string, string> = {
  'dash.days_since_visit': '{days} days since visit',
  'dash.unenrolled_backlog': '{count} people not enrolled in any program',
};

vi.mock('../../hooks/useTranslation', async () => {
  const { t } = await import('@naru/shared');
  return {
    useTranslation: () => ({
      t: (key: string) => EXTRA[key] ?? t(key as Parameters<typeof t>[0], 'en'),
      lang: 'en',
    }),
  };
});

const MS_PER_DAY = 86_400_000;
const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);

const dashboardData: DashboardResponse = {
  recentVisits: [],
  enrollmentsByProgram: [
    { programId: 1, programName: 'Expectant Mother', programKind: 'PREGNANCY', active: 42 },
    { programId: 2, programName: 'Nutrition Infant', programKind: 'NUTRITION', active: 31 },
  ],
  familiesInCrisis: [],
  stats: {
    activeEnrollments: 127,
    totalChildren: 45,
    totalMothers: 20,
    totalPeople: 8,
    totalFamilies: 25,
    totalCommunities: 7,
    familiesInCrisis: 3,
    visitsThisMonth: 12,
    unenrolledSubjects: 38,
  },
  visitsPerMonth: [],
  newcomersPerMonth: [],
  communityBreakdown: [],
};

const programBase = {
  description: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  active: true,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const programs: ProgramRead[] = [
  {
    ...programBase,
    id: 1,
    name: 'Expectant Mother',
    kind: 'PREGNANCY',
    subjectType: 'MOTHER',
    visitIntervalDays: 30,
  },
  {
    ...programBase,
    id: 2,
    name: 'Nutrition Infant',
    kind: 'NUTRITION',
    subjectType: 'CHILD',
    visitIntervalDays: 30,
  },
];

const enrollmentBase = {
  localId: null,
  motherId: null,
  childId: null,
  personId: null,
  familyId: null,
  enrolledAt: '2024-02-01',
  entryWeight: null,
  entryPhotoId: null,
  admissionNotes: null,
  exitedAt: null,
  exitReason: null,
  exitWeight: null,
  exitPhotoId: null,
  exitNotes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  visitCount: 2,
  pregnancyDetail: null,
  nutritionDetail: null,
  studentDetail: null,
};

const activeEnrollments: EnrollmentListItem[] = [
  {
    ...enrollmentBase,
    id: 11,
    programId: 1,
    motherId: 3,
    subjectName: 'Ana Morales',
    lastVisitDate: isoDaysAgo(34),
    program: { id: 1, name: 'Expectant Mother', kind: 'PREGNANCY', subjectType: 'MOTHER' },
  },
  {
    ...enrollmentBase,
    id: 12,
    programId: 2,
    childId: 4,
    subjectName: 'Rosa Tzul',
    lastVisitDate: isoDaysAgo(3),
    program: { id: 2, name: 'Nutrition Infant', kind: 'NUTRITION', subjectType: 'CHILD' },
  },
];

const visitBase = {
  localId: null,
  locationType: 'HOME' as const,
  siteId: null,
  communityId: null,
  recordedById: null,
  eventId: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  resources: [],
  trainingIds: [],
  answers: [],
  pregnancyDetail: null,
  recordedByName: null,
  program: {
    id: 2,
    name: 'Nutrition Infant',
    kind: 'NUTRITION' as const,
    subjectType: 'CHILD' as const,
  },
};

const nutritionDetail = (weight: number, status: 'SEVERE' | 'MODERATE' | 'MILD' | 'NORMAL') => ({
  weight,
  height: null,
  armCircumference: null,
  weightForAgeZ: null,
  heightForAgeZ: null,
  weightForHeightZ: null,
  muacZ: null,
  nutritionalStatus: status,
});

const visits: VisitListItem[] = [
  {
    ...visitBase,
    id: 201,
    enrollmentId: 12,
    visitDate: isoDaysAgo(3),
    subjectName: 'Pedro Vasquez',
    nutritionDetail: nutritionDetail(3.9, 'SEVERE'),
  },
  {
    ...visitBase,
    id: 202,
    enrollmentId: 12,
    visitDate: isoDaysAgo(33),
    subjectName: 'Pedro Vasquez',
    nutritionDetail: nutritionDetail(4.4, 'MODERATE'),
  },
];

const newcomersReport: ReportResponse = {
  slug: 'newcomers',
  title: 'Newcomers per month',
  columns: [],
  rows: [
    { month: '2026-09', siteName: 'Highlands', newcomers: 12 },
    { month: '2026-09', siteName: 'Coast', newcomers: 6 },
  ],
  total: 2,
};

const graduationsReport: ReportResponse = {
  slug: 'graduations',
  title: 'Graduations',
  columns: [],
  rows: [],
  total: 9,
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const statValue = (label: string): string =>
  screen.getByText(label).parentElement?.textContent ?? '';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardApi.fetchDashboardData).mockResolvedValue(dashboardData);
    vi.mocked(programsApi.listPrograms).mockResolvedValue({
      items: programs,
      total: programs.length,
    });
    vi.mocked(enrollmentsApi.listEnrollments).mockResolvedValue({
      items: activeEnrollments,
      total: activeEnrollments.length,
      skip: 0,
      limit: 100,
    });
    vi.mocked(visitsApi.listVisits).mockResolvedValue({
      items: visits,
      total: visits.length,
      skip: 0,
      limit: 100,
    });
    vi.mocked(reportsApi.fetchReport).mockImplementation(async (slug) =>
      slug === 'newcomers' ? newcomersReport : graduationsReport
    );
  });

  it('greets the signed-in user by name', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Caleb');
    });
  });

  it('renders the four operational stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('dash.stat_enrolled')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(statValue('dash.stat_new_this_month')).toContain('18');
    });

    expect(statValue('dash.stat_enrolled')).toContain('127');
    expect(statValue('dash.stat_graduated')).toContain('9');
    expect(statValue('dash.stat_overdue')).toContain('1');
  });

  it('lists overdue visits, deteriorating status and the unenrolled backlog under needs attention', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ana Morales')).toBeInTheDocument();
    });

    expect(screen.getByText('34 days since visit')).toBeInTheDocument();
    expect(screen.getByText('Ana Morales').closest('a')).toHaveAttribute('href', '/enrollments/11');

    await waitFor(() => {
      expect(screen.getByText(/visit\.worsening/)).toBeInTheDocument();
    });

    const backlog = screen.getByText('38 people not enrolled in any program');
    expect(backlog.closest('a')).toHaveAttribute('href', '/unenrolled');
  });

  it('draws one bar per program linking to its roster', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Expectant Mother').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();

    const bar = screen
      .getAllByText('Expectant Mother')
      .find((node) => node.closest('a')?.getAttribute('href') === '/programs/1');
    expect(bar).toBeDefined();
  });

  it('shows recent visits with their weight and persisted status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Vasquez').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/3\.9/)).toBeInTheDocument();
  });

  it('shows a loading state while the dashboard loads', () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows an error state when the dashboard request fails', async () => {
    vi.mocked(dashboardApi.fetchDashboardData).mockRejectedValue(new Error('boom'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });
});
