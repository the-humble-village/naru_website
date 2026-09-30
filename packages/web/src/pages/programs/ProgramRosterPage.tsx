import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  EnrollmentListItem,
  NutritionalStatus,
  ProgramRead,
  SubjectType,
  TranslationKey,
  VisitListItem,
} from '@naru/shared';
import { programsApi } from '../../api/programs';
import { enrollmentsApi } from '../../api/enrollments';
import { visitsApi } from '../../api/visits';
import { mothersApi } from '../../api/mothers';
import { childrenApi } from '../../api/children';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import {
  FilterBar,
  LoadingState,
  PageHeader,
  ProgramRosterTable,
  StatStrip,
  Tabs,
} from '../../components';
import type { FilterValues, RosterRow, StatStripItem } from '../../components';
import { useTranslation } from '../../hooks';

type TabKey = 'active' | 'exited' | 'all';

const TAB_KEYS: TabKey[] = ['active', 'exited', 'all'];
const ROWS_PER_PAGE = 25;
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 20;
const MS_PER_DAY = 86_400_000;

const STATUS_ORDER: NutritionalStatus[] = ['SEVERE', 'MODERATE', 'MILD', 'NORMAL'];

const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};

interface SubjectInfo {
  birthDate: string | null;
  communityId: number | null;
}

interface LatestVisit {
  weight: number | null;
  gestationMonths: number | null;
  nutritionalStatus: NutritionalStatus | null;
}

/**
 * The list endpoints cap a page at 100 rows and the roster needs the whole
 * program in hand: search, the four stats and the site filter are all computed
 * across every enrollment, not just the visible page. MAX_FETCH_PAGES is the
 * stop so a runaway dataset cannot hang the field tool.
 */
async function fetchAllPages<T>(
  page: (skip: number, limit: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const collected: T[] = [];

  for (let index = 0; index < MAX_FETCH_PAGES; index += 1) {
    const result = await page(collected.length, FETCH_PAGE_SIZE);
    collected.push(...result.items);
    if (result.items.length === 0 || collected.length >= result.total) {
      break;
    }
  }

  return collected;
}

const fetchSubjects = async (
  subjectType: SubjectType,
  programId: number
): Promise<Map<number, SubjectInfo>> => {
  const map = new Map<number, SubjectInfo>();

  if (subjectType === 'MOTHER') {
    const rows = await fetchAllPages((skip, limit) => mothersApi.listMothers({ skip, limit }));
    rows.forEach((row) =>
      map.set(row.id, { birthDate: row.birthDate, communityId: row.communityId })
    );
  } else if (subjectType === 'CHILD') {
    const rows = await fetchAllPages((skip, limit) => childrenApi.listChildren({ skip, limit }));
    rows.forEach((row) =>
      map.set(row.id, { birthDate: row.birthDate, communityId: row.communityId })
    );
  } else if (subjectType === 'PERSON') {
    const rows = await fetchAllPages((skip, limit) =>
      peopleApi.listPeople({ programId, skip, limit })
    );
    rows.forEach((row) =>
      map.set(row.id, { birthDate: row.birthDate, communityId: row.communityId })
    );
  } else {
    const rows = await fetchAllPages(async (skip, limit) => {
      const response = await familiesApi.listFamilies({ skip, limit });
      return { items: response.families, total: response.total };
    });
    rows.forEach((row) => map.set(row.id, { birthDate: null, communityId: row.communityId }));
  }

  return map;
};

const subjectIdOf = (enrollment: EnrollmentListItem): number | null =>
  enrollment.motherId ?? enrollment.childId ?? enrollment.personId ?? enrollment.familyId ?? null;

const subjectHrefOf = (enrollment: EnrollmentListItem): string | undefined => {
  if (enrollment.motherId) return `/mothers/${enrollment.motherId}`;
  if (enrollment.childId) return `/children/${enrollment.childId}`;
  if (enrollment.personId) return `/people/${enrollment.personId}`;
  if (enrollment.familyId) return `/families/${enrollment.familyId}`;
  return undefined;
};

const daysSince = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / MS_PER_DAY));
};

const startOfMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const toId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const ProgramRosterPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const programId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tab: TabKey = TAB_KEYS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'active';
  const search = searchParams.get('q') ?? '';
  const siteId = toId(searchParams.get('siteId'));
  const communityId = toId(searchParams.get('communityId'));
  const rawStatus = searchParams.get('status');
  const status = STATUS_ORDER.includes(rawStatus as NutritionalStatus)
    ? (rawStatus as NutritionalStatus)
    : null;
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);

  // The whole filter set lives in the query string: a filtered roster is what a
  // supervisor bookmarks and shares.
  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    if (!Object.prototype.hasOwnProperty.call(updates, 'page')) {
      next.delete('page');
    }
    setSearchParams(next, { replace: true });
  };

  const programQuery = useQuery({
    queryKey: ['program', programId],
    queryFn: () => programsApi.fetchProgram(programId),
    enabled: Number.isFinite(programId) && programId > 0,
  });

  const program: ProgramRead | undefined = programQuery.data;

  const enrollmentsQuery = useQuery({
    queryKey: ['program-roster', programId],
    queryFn: () =>
      fetchAllPages<EnrollmentListItem>((skip, limit) =>
        enrollmentsApi.listEnrollments({ programId, status: 'all', skip, limit })
      ),
    enabled: Number.isFinite(programId) && programId > 0,
  });

  const subjectsQuery = useQuery({
    queryKey: ['roster-subjects', programId, program?.subjectType],
    queryFn: () => fetchSubjects(program!.subjectType, programId),
    enabled: !!program,
  });

  const needsVisitDetail = program?.kind === 'PREGNANCY' || program?.kind === 'NUTRITION';

  const visitsQuery = useQuery({
    queryKey: ['roster-visits', programId],
    queryFn: async () => {
      const visits = await fetchAllPages<VisitListItem>((skip, limit) =>
        visitsApi.listVisits({ programId, skip, limit })
      );

      // Visits arrive newest first, so the first row seen for an enrollment is
      // its latest visit.
      const latest = new Map<number, LatestVisit>();
      visits.forEach((visit) => {
        if (latest.has(visit.enrollmentId)) return;
        latest.set(visit.enrollmentId, {
          weight: visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null,
          gestationMonths: visit.pregnancyDetail?.gestationMonths ?? null,
          nutritionalStatus: visit.nutritionDetail?.nutritionalStatus ?? null,
        });
      });
      return latest;
    },
    enabled: !!program && needsVisitDetail,
  });

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });

  const communityById = useMemo(() => {
    const map = new Map<number, { title: string; siteId: number | null }>();
    communities.forEach((community) =>
      map.set(community.id, { title: community.title, siteId: community.siteId ?? null })
    );
    return map;
  }, [communities]);

  const enrollments = useMemo(() => enrollmentsQuery.data ?? [], [enrollmentsQuery.data]);
  const subjects = subjectsQuery.data;
  const latestVisits = visitsQuery.data;

  const stats = useMemo(() => {
    const monthStart = startOfMonth();
    const interval = program?.visitIntervalDays ?? null;

    let active = 0;
    let newThisMonth = 0;
    let exitedThisMonth = 0;
    let overdue = 0;

    enrollments.forEach((enrollment) => {
      const isActive = enrollment.exitedAt === null;
      if (isActive) active += 1;
      if (enrollment.enrolledAt >= monthStart) newThisMonth += 1;
      if (enrollment.exitedAt !== null && enrollment.exitedAt >= monthStart) exitedThisMonth += 1;

      if (isActive && interval !== null && enrollment.lastVisitDate) {
        const days = daysSince(enrollment.lastVisitDate);
        if (days !== null && days > interval) overdue += 1;
      }
    });

    return { active, newThisMonth, exitedThisMonth, overdue };
  }, [enrollments, program?.visitIntervalDays]);

  const allRows = useMemo(() => {
    return enrollments.map((enrollment) => {
      const subjectId = subjectIdOf(enrollment);
      const subject = subjectId !== null ? subjects?.get(subjectId) : undefined;
      const latest = latestVisits?.get(enrollment.id);
      const community =
        subject?.communityId != null ? communityById.get(subject.communityId) : undefined;

      const row: RosterRow = {
        enrollmentId: enrollment.id,
        subjectName: enrollment.subjectName,
        subjectHref: subjectHrefOf(enrollment),
        birthDate: subject?.birthDate ?? null,
        communityName: community?.title ?? null,
        entryWeight: enrollment.entryWeight,
        latestWeight: latest?.weight ?? enrollment.exitWeight ?? null,
        gestationMonths: latest?.gestationMonths ?? null,
        dueDate: enrollment.pregnancyDetail?.dueDate ?? null,
        nutritionalStatus:
          latest?.nutritionalStatus ?? enrollment.nutritionDetail?.nutritionalStatus ?? null,
        school: enrollment.studentDetail?.school ?? null,
        classYear: enrollment.studentDetail?.classYear ?? null,
        lastVisitDate: enrollment.lastVisitDate,
        exitedAt: enrollment.exitedAt,
        exitReason: enrollment.exitReason,
      };

      return {
        row,
        exited: enrollment.exitedAt !== null,
        communityId: subject?.communityId ?? null,
        siteId: community?.siteId ?? null,
      };
    });
  }, [enrollments, subjects, latestVisits, communityById]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return allRows
      .filter((entry) => {
        if (tab === 'active' && entry.exited) return false;
        if (tab === 'exited' && !entry.exited) return false;
        if (needle && !(entry.row.subjectName ?? '').toLowerCase().includes(needle)) return false;
        if (communityId !== null && entry.communityId !== communityId) return false;
        if (siteId !== null && entry.siteId !== siteId) return false;
        if (status !== null && entry.row.nutritionalStatus !== status) return false;
        return true;
      })
      .map((entry) => entry.row);
  }, [allRows, tab, search, communityId, siteId, status]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(
    currentPage * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE
  );

  const isLoading =
    programQuery.isLoading ||
    enrollmentsQuery.isLoading ||
    subjectsQuery.isLoading ||
    (needsVisitDetail && visitsQuery.isLoading);

  if (programQuery.isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (programQuery.isError || !program) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('admin.program_load_failed')}</p>
      </div>
    );
  }

  const statItems: StatStripItem[] = [
    { label: t('roster.stat_active'), value: stats.active },
    { label: t('roster.stat_new_this_month'), value: stats.newThisMonth },
    { label: t('roster.stat_exited_this_month'), value: stats.exitedThisMonth },
  ];

  // A program with no cadence never flags overdue, so the stat is omitted
  // rather than shown as a wrong zero.
  if (program.visitIntervalDays !== null) {
    statItems.push({
      label: t('roster.stat_overdue'),
      tone: 'crisis',
      value: (
        <span className="inline-flex items-center gap-2">
          {stats.overdue}
          {stats.overdue > 0 && <span aria-hidden="true">&#9888;</span>}
        </span>
      ),
    });
  }

  const filterValues: FilterValues = { siteId, communityId };

  const handleFilterChange = (value: FilterValues) => {
    updateParams({
      siteId: value.siteId != null ? String(value.siteId) : null,
      communityId: value.communityId != null ? String(value.communityId) : null,
    });
  };

  const filtersActive =
    search.trim() !== '' || siteId !== null || communityId !== null || status !== null;

  const statusFilter = (
    <div className="min-w-0 md:w-48">
      <label htmlFor="roster-status" className="block text-sm font-medium text-hv-gray mb-1">
        {t('roster.status')}
      </label>
      <select
        id="roster-status"
        value={status ?? ''}
        onChange={(event) => updateParams({ status: event.target.value || null })}
        className="w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
      >
        <option value="">{t('common.all')}</option>
        {STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {t(STATUS_LABEL[value])}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={program.name}
        backTo="/programs"
        backLabel={t('nav.programs')}
        actions={
          <Link
            to={`/programs/${program.id}/enroll`}
            className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
          >
            {t('roster.enroll')}
          </Link>
        }
      />

      <StatStrip stats={statItems} className="mb-6" />

      <Tabs
        label={t('roster.tabs_label')}
        value={tab}
        onChange={(key) => updateParams({ tab: key === 'active' ? null : key })}
        tabs={[
          { key: 'active', label: t('enrollment.active'), count: stats.active },
          {
            key: 'exited',
            label: t('enrollment.exited'),
            count: enrollments.length - stats.active,
          },
          { key: 'all', label: t('common.all'), count: enrollments.length },
        ]}
        className="mb-4"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-end mb-6">
        <div className="min-w-0 md:w-64">
          <label htmlFor="roster-search" className="block text-sm font-medium text-hv-gray mb-1">
            {t('roster.search')}
          </label>
          <input
            id="roster-search"
            type="search"
            value={search}
            placeholder={t('roster.search_placeholder')}
            onChange={(event) => updateParams({ q: event.target.value })}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
          />
        </div>

        <FilterBar
          fields={['site', 'community']}
          value={filterValues}
          onChange={handleFilterChange}
          sites={sites}
          communities={communities}
          actions={program.kind === 'NUTRITION' ? statusFilter : undefined}
          className="flex-1"
        />
      </div>

      <div className="bg-white rounded-lg border border-hv-border overflow-hidden md:shadow-sm">
        <ProgramRosterTable
          kind={program.kind}
          rows={visibleRows}
          visitIntervalDays={program.visitIntervalDays}
          variant={tab === 'exited' ? 'exited' : 'active'}
          isLoading={isLoading}
          emptyMessage={filtersActive ? t('roster.no_matches') : t('roster.empty')}
        />
      </div>

      {filteredRows.length > ROWS_PER_PAGE && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-hv-gray">
            {t('roster.showing')
              .replace('{from}', String(currentPage * ROWS_PER_PAGE + 1))
              .replace('{to}', String(currentPage * ROWS_PER_PAGE + visibleRows.length))
              .replace('{total}', String(filteredRows.length))}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => updateParams({ page: String(currentPage - 1) })}
              className="px-4 py-2 rounded border border-hv-border text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => updateParams({ page: String(currentPage + 1) })}
              className="px-4 py-2 rounded border border-hv-border text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramRosterPage;
