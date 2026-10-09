import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  EnrollmentListItem,
  NutritionalStatus,
  TranslationKey,
  VisitListItem,
} from '@naru/shared';
import { dashboardApi } from '../api/dashboard';
import { enrollmentsApi } from '../api/enrollments';
import { programsApi } from '../api/programs';
import { visitsApi } from '../api/visits';
import { reportsApi } from '../api/reports';
import { EmptyState, LoadingState, StatStrip } from '../components';
import type { StatStripItem } from '../components';
import { useTranslation } from '../hooks';
import { useAuthStore } from '../store/auth';

const MS_PER_DAY = 86_400_000;
const FETCH_PAGE_SIZE = 100;
const MAX_ENROLLMENT_PAGES = 20;
const RECENT_VISIT_PAGES = 2;
const RECENT_VISIT_ROWS = 8;
const ATTENTION_ROWS = 5;

const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};

const STATUS_TONE: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-600 text-white',
  MODERATE: 'bg-red-400 text-white',
  MILD: 'bg-yellow-500 text-white',
  NORMAL: 'bg-green-500 text-white',
};

const STATUS_RANK: Record<NutritionalStatus, number> = {
  NORMAL: 0,
  MILD: 1,
  MODERATE: 2,
  SEVERE: 3,
};

const daysSince = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / MS_PER_DAY));
};

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const greetingKey = (): TranslationKey => {
  const hour = new Date().getHours();
  if (hour < 12) return 'dash.good_morning';
  if (hour < 18) return 'dash.good_afternoon';
  return 'dash.good_evening';
};

interface AttentionRow {
  key: string;
  to: string;
  name: string;
  context: string;
  detail: string;
  severity: number;
}

const SECTION = 'bg-white rounded-lg border border-hv-border p-6';
const SECTION_TITLE = 'text-sm font-semibold uppercase tracking-wider text-hv-gray mb-4';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const monthStart = useMemo(() => {
    const now = new Date();
    return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);
  const today = useMemo(() => isoDate(new Date()), []);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.fetchDashboardData,
  });

  const programsQuery = useQuery({
    queryKey: ['programs', 'index'],
    queryFn: () => programsApi.listPrograms(),
  });

  const activeEnrollmentsQuery = useQuery({
    queryKey: ['dashboard-active-enrollments'],
    queryFn: async () => {
      const collected: EnrollmentListItem[] = [];
      for (let index = 0; index < MAX_ENROLLMENT_PAGES; index += 1) {
        const result = await enrollmentsApi.listEnrollments({
          status: 'active',
          skip: collected.length,
          limit: FETCH_PAGE_SIZE,
        });
        collected.push(...result.items);
        if (result.items.length === 0 || collected.length >= result.total) break;
      }
      return collected;
    },
  });

  const recentVisitsQuery = useQuery({
    queryKey: ['dashboard-recent-visits'],
    queryFn: async () => {
      const collected: VisitListItem[] = [];
      for (let index = 0; index < RECENT_VISIT_PAGES; index += 1) {
        const result = await visitsApi.listVisits({
          skip: collected.length,
          limit: FETCH_PAGE_SIZE,
        });
        collected.push(...result.items);
        if (result.items.length === 0 || collected.length >= result.total) break;
      }
      return collected;
    },
  });

  const newcomersQuery = useQuery({
    queryKey: ['dashboard-newcomers', monthStart, today],
    queryFn: () => reportsApi.fetchReport('newcomers', { from: monthStart, to: today }),
  });

  const graduationsQuery = useQuery({
    queryKey: ['dashboard-graduations', monthStart, today],
    queryFn: () => reportsApi.fetchReport('graduations', { from: monthStart, to: today }),
  });

  const dashboard = dashboardQuery.data;

  const intervalByProgram = useMemo(() => {
    const map = new Map<number, number | null>();
    (programsQuery.data?.items ?? []).forEach((program) =>
      map.set(program.id, program.visitIntervalDays)
    );
    return map;
  }, [programsQuery.data]);

  const overdue = useMemo(() => {
    const rows: AttentionRow[] = [];

    (activeEnrollmentsQuery.data ?? []).forEach((enrollment) => {
      const interval = intervalByProgram.get(enrollment.programId) ?? null;
      if (interval === null || !enrollment.lastVisitDate) return;

      const days = daysSince(enrollment.lastVisitDate);
      if (days === null || days <= interval) return;

      rows.push({
        key: `overdue-${enrollment.id}`,
        to: `/enrollments/${enrollment.id}`,
        name: enrollment.subjectName ?? t('common.unnamed'),
        context: enrollment.program.name,
        detail: t('dash.days_since_visit').replace('{days}', String(days)),
        severity: days,
      });
    });

    return rows.sort((a, b) => b.severity - a.severity);
  }, [activeEnrollmentsQuery.data, intervalByProgram, t]);

  // Nutritional status is persisted on each visit, so deterioration is read off
  // consecutive visits rather than recomputed.
  const deteriorating = useMemo(() => {
    const byEnrollment = new Map<number, VisitListItem[]>();

    (recentVisitsQuery.data ?? []).forEach((visit) => {
      if (!visit.nutritionDetail?.nutritionalStatus) return;
      const existing = byEnrollment.get(visit.enrollmentId);
      if (existing) {
        existing.push(visit);
      } else {
        byEnrollment.set(visit.enrollmentId, [visit]);
      }
    });

    const rows: AttentionRow[] = [];

    byEnrollment.forEach((visits, enrollmentId) => {
      const latest = visits[0]?.nutritionDetail?.nutritionalStatus;
      const previous = visits[1]?.nutritionDetail?.nutritionalStatus;
      if (!latest) return;

      const falling = !!previous && STATUS_RANK[latest] > STATUS_RANK[previous];
      if (!falling && latest !== 'SEVERE' && latest !== 'MODERATE') return;

      const label = t(STATUS_LABEL[latest]);

      rows.push({
        key: `status-${enrollmentId}`,
        to: `/enrollments/${enrollmentId}`,
        name: visits[0]?.subjectName ?? t('common.unnamed'),
        context: visits[0]?.program.name ?? '',
        detail: falling ? `${label}, ${t('visit.worsening')}` : label,
        severity: STATUS_RANK[latest] + (falling ? 10 : 0),
      });
    });

    return rows.sort((a, b) => b.severity - a.severity);
  }, [recentVisitsQuery.data, t]);

  const newThisMonth = useMemo(() => {
    const rows = newcomersQuery.data?.rows ?? [];
    return rows.reduce((total, row) => {
      const value = row.newcomers;
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
  }, [newcomersQuery.data]);

  const recentVisits = (recentVisitsQuery.data ?? []).slice(0, RECENT_VISIT_ROWS);
  const unenrolled = dashboard?.stats.unenrolledSubjects ?? 0;

  const statItems: StatStripItem[] = [
    { label: t('dash.stat_enrolled'), value: dashboard?.stats.activeEnrollments ?? 0 },
    { label: t('dash.stat_new_this_month'), value: newThisMonth },
    { label: t('dash.stat_graduated'), value: graduationsQuery.data?.total ?? 0 },
    {
      label: t('dash.stat_overdue'),
      tone: 'crisis',
      value: (
        <span className="inline-flex items-center gap-2">
          {overdue.length}
          {overdue.length > 0 && <span aria-hidden="true">&#9888;</span>}
        </span>
      ),
    },
  ];

  const attentionRows = [
    ...overdue.slice(0, ATTENTION_ROWS),
    ...deteriorating.slice(0, ATTENTION_ROWS),
  ];

  const programBars = useMemo(() => {
    const bars = (dashboard?.enrollmentsByProgram ?? [])
      .slice()
      .sort((a, b) => b.active - a.active);
    const max = bars.reduce((highest, bar) => Math.max(highest, bar.active), 0);
    return bars.map((bar) => ({ ...bar, share: max > 0 ? (bar.active / max) * 100 : 0 }));
  }, [dashboard?.enrollmentsByProgram]);

  const greeting = user?.firstName ? `${t(greetingKey())}, ${user.firstName}` : t(greetingKey());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{greeting}</h1>

      {dashboardQuery.isLoading && <LoadingState message={t('common.loading')} />}

      {dashboardQuery.isError && !dashboardQuery.isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{t('dash.no_data')}</p>
        </div>
      )}

      {!dashboardQuery.isLoading && !dashboardQuery.isError && (
        <>
          <StatStrip stats={statItems} />

          <section className={SECTION}>
            <h2 className={`${SECTION_TITLE} flex items-center gap-2 text-hv-crisis`}>
              <span aria-hidden="true">&#9888;</span>
              {t('dash.needs_attention')}
            </h2>

            {attentionRows.length === 0 && unenrolled === 0 ? (
              <EmptyState message={t('dash.nothing_needs_attention')} />
            ) : (
              <ul className="divide-y divide-hv-border">
                {attentionRows.map((row) => (
                  <li key={row.key}>
                    <Link
                      to={row.to}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4 hover:bg-hv-page transition-colors"
                    >
                      <span className="font-medium text-hv-green sm:w-48 sm:shrink-0">
                        {row.name}
                      </span>
                      <span className="text-sm text-hv-gray sm:w-48 sm:shrink-0">{row.context}</span>
                      <span className="text-sm text-hv-crisis font-medium">{row.detail}</span>
                      <span className="ml-auto hidden text-hv-gray sm:inline" aria-hidden="true">
                        &rarr;
                      </span>
                    </Link>
                  </li>
                ))}

                {unenrolled > 0 && (
                  <li>
                    <Link
                      to="/unenrolled"
                      className="flex items-center gap-4 py-3 hover:bg-hv-page transition-colors"
                    >
                      <span className="text-sm font-medium text-hv-charcoal">
                        {t('dash.unenrolled_backlog').replace('{count}', String(unenrolled))}
                      </span>
                      <span className="ml-auto hidden text-hv-gray sm:inline" aria-hidden="true">
                        &rarr;
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>{t('dash.enrolled_by_program')}</h2>

            {programBars.length === 0 ? (
              <EmptyState message={t('dash.no_programs')} />
            ) : (
              <ul className="space-y-3">
                {programBars.map((bar) => (
                  <li key={bar.programId}>
                    <Link to={`/programs/${bar.programId}`} className="flex items-center gap-3 group">
                      <span className="w-40 shrink-0 truncate text-sm text-hv-charcoal group-hover:text-hv-green transition-colors">
                        {bar.programName}
                      </span>
                      <span className="h-3 flex-1 rounded-full bg-hv-page overflow-hidden">
                        <span
                          className="block h-full rounded-full bg-hv-green"
                          style={{ width: `${bar.share}%` }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-hv-charcoal">
                        {bar.active}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>{t('dash.recent_visits')}</h2>

            {recentVisits.length === 0 ? (
              <EmptyState message={t('dash.no_visits')} />
            ) : (
              <ul className="divide-y divide-hv-border">
                {recentVisits.map((visit) => {
                  const weight =
                    visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null;
                  const status = visit.nutritionDetail?.nutritionalStatus ?? null;

                  return (
                    <li key={visit.id}>
                      <Link
                        to={`/visits/${visit.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-hv-page transition-colors"
                      >
                        <span className="text-sm tabular-nums text-hv-gray sm:w-28 sm:shrink-0">
                          {visit.visitDate}
                        </span>
                        <span className="font-medium text-hv-green sm:w-48 sm:shrink-0">
                          {visit.subjectName ?? t('common.unnamed')}
                        </span>
                        <span className="text-sm text-hv-gray sm:w-48 sm:shrink-0">
                          {visit.program.name}
                        </span>
                        {weight !== null && (
                          <span className="text-sm tabular-nums text-hv-charcoal">
                            {weight.toFixed(1)}
                            {t('dash.kg_suffix')}
                          </span>
                        )}
                        {status && (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_TONE[status]}`}
                          >
                            {t(STATUS_LABEL[status])}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
