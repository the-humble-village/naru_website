import React, { useMemo, useRef } from 'react';
import { ArrowLeft, Plus, UsersRound, FilePlus2, LogOut, Clock3, SlidersHorizontal, RotateCcw, Search, X } from 'lucide-react';
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
import { LoadingState, ProgramRosterTable, Tabs } from '../../components';
import type { RosterRow } from '../../components';
import { useTranslation } from '../../hooks';

type TabKey = 'active' | 'exited' | 'all';

const TAB_KEYS: TabKey[] = ['active', 'exited', 'all'];
const ROWS_PER_PAGE = 25;
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 20;
const MS_PER_DAY = 86_400_000;
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';
const FIELD = 'min-h-11 w-full min-w-0 rounded-lg border border-hv-border bg-white px-3 py-2 text-sm text-hv-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green';
const LABEL = 'mb-1 block text-sm font-medium text-hv-gray';

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tab: TabKey = TAB_KEYS.includes(rawTab as TabKey) ? (rawTab as TabKey) : 'active';
  const search = searchParams.get('q') ?? '';
  const siteId = toId(searchParams.get('siteId'));
  const communityId = toId(searchParams.get('communityId'));
  const rawStatus = searchParams.get('status');
  const requestedStatus = STATUS_ORDER.includes(rawStatus as NutritionalStatus)
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
  const status = program?.kind === 'NUTRITION' ? requestedStatus : null;

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

  const hasRosterError = enrollmentsQuery.isError || subjectsQuery.isError || (needsVisitDetail && visitsQuery.isError);
  const isFamily = program.kind === 'FAMILY_PAF';
  const statItems = [
    { label: t('roster.stat_active'), value: stats.active, icon: UsersRound, alert: false },
    { label: t('roster.stat_new_this_month'), value: stats.newThisMonth, icon: FilePlus2, alert: false },
    { label: t('roster.stat_exited_this_month'), value: stats.exitedThisMonth, icon: LogOut, alert: false },
  ];
  // Programs without a visit schedule have no overdue metric.
  if (program.visitIntervalDays !== null) {
    statItems.push({ label: t('roster.stat_overdue'), value: stats.overdue, icon: Clock3, alert: stats.overdue > 0 });
  }
  const filtersActive = search.trim() !== '' || siteId !== null || communityId !== null || status !== null;
  const communityOptions = communities.filter(community => siteId === null || community.siteId === siteId);
  const clearFilters = () => updateParams({ q: null, siteId: null, communityId: null, status: null });
  const countLabel = filteredRows.length > ROWS_PER_PAGE
    ? t('roster.showing')
      .replace('{from}', String(currentPage * ROWS_PER_PAGE + 1))
      .replace('{to}', String(currentPage * ROWS_PER_PAGE + visibleRows.length))
      .replace('{total}', String(filteredRows.length))
    : t('roster.result_count').replace('{count}', String(filteredRows.length));

  return (
    <div className="mx-auto max-w-screen-2xl py-1">
      <header className="mb-4 grid grid-cols-[1fr_auto] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <Link to="/programs" className={`inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded text-sm font-medium text-hv-terracotta hover:text-hv-green ${FOCUS}`}>
          <ArrowLeft aria-hidden="true" size={16} />{t('nav.all_programs')}
        </Link>
        <div className="order-3 col-span-2 text-center lg:order-2 lg:col-span-1">
          <h1 className="break-words font-serif text-3xl font-bold tracking-tight text-hv-green">{program.name}</h1>
          {program.description && <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray">{program.description}</p>}
        </div>
        <Link to={`/programs/${program.id}/enroll`}
          className={`order-2 inline-flex min-h-11 items-center justify-center gap-2 justify-self-end rounded-lg bg-hv-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-hv-terracotta-hover lg:order-3 ${FOCUS}`}>
          <Plus aria-hidden="true" size={17} />{t(isFamily ? 'roster.enroll_family' : 'roster.enroll')}
        </Link>
      </header>

      <section aria-label={t('roster.summary')} className="mb-4 rounded-xl border border-hv-green/15 bg-[#eaf0e9] p-2.5">
        <dl className={`grid grid-cols-2 gap-2.5 ${statItems.length === 4 ? 'md:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {statItems.map(stat => (
            <div key={stat.label} className="relative flex min-w-0 flex-col rounded-lg bg-white p-3">
              <dt className="order-2 mt-1 text-xs text-hv-gray">{stat.label}</dt>
              <dd className={`order-1 pr-10 text-3xl font-semibold leading-none tabular-nums ${stat.alert ? 'text-hv-crisis' : 'text-hv-green'}`}>
                {enrollmentsQuery.isLoading || enrollmentsQuery.isError ? '—' : stat.value}
              </dd>
              <span aria-hidden="true" className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full ${stat.alert ? 'bg-red-50 text-hv-crisis' : 'bg-[#eaf0e9] text-hv-green'}`}>
                <stat.icon size={17} />
              </span>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[208px_minmax(0,1fr)]">
        <aside aria-labelledby="roster-filter-heading" className="min-w-0 rounded-xl border border-hv-green/15 bg-[#eaf0e9] p-4">
          <h2 id="roster-filter-heading" className="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-hv-green">
            <SlidersHorizontal aria-hidden="true" size={22} className="shrink-0 text-hv-terracotta" />
            {t(isFamily ? 'roster.filter_families' : 'roster.filter_members')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="min-w-0">
              <label htmlFor="filter-site" className={LABEL}>{t('filter.site')}</label>
              <select id="filter-site" value={siteId ?? ''} className={FIELD} onChange={event => {
                const nextSite = toId(event.target.value);
                const keepCommunity = nextSite === null || communities.find(community => community.id === communityId)?.siteId === nextSite;
                updateParams({ siteId: event.target.value, communityId: keepCommunity && communityId !== null ? String(communityId) : null });
              }}>
                <option value="">{t('visit.all_sites')}</option>
                {sites.map(site => <option key={site.id} value={site.id}>{site.title}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="filter-community" className={LABEL}>{t('filter.community')}</label>
              <select id="filter-community" value={communityId ?? ''} className={FIELD} onChange={event => updateParams({ communityId: event.target.value })}>
                <option value="">{t('visit.all_communities')}</option>
                {communityOptions.map(community => <option key={community.id} value={community.id}>{community.title}</option>)}
              </select>
            </div>
            {program.kind === 'NUTRITION' && (
              <div className="min-w-0">
                <label htmlFor="roster-status" className={LABEL}>{t('roster.nutrition_status')}</label>
                <select id="roster-status" value={status ?? ''} className={FIELD} onChange={event => updateParams({ status: event.target.value })}>
                  <option value="">{t('roster.all_statuses')}</option>
                  {STATUS_ORDER.map(value => <option key={value} value={value}>{t(STATUS_LABEL[value])}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-5 border-t border-hv-green/15 pt-3">
            <button type="button" onClick={clearFilters} disabled={!filtersActive}
              className={`inline-flex min-h-11 items-center gap-2 rounded text-sm text-hv-terracotta hover:text-hv-green disabled:cursor-default disabled:text-hv-gray ${FOCUS}`}>
              <RotateCcw aria-hidden="true" size={16} />{t('roster.clear_filters')}
            </button>
          </div>
        </aside>

        <section aria-label={t('roster.records')} className="min-w-0 rounded-xl border border-hv-border bg-white p-3">
          <Tabs label={t('roster.tabs_label')} value={tab}
            onChange={key => updateParams({ tab: key === 'active' ? null : key })}
            tabs={[
              { key: 'active', label: t('enrollment.active'), count: stats.active },
              { key: 'exited', label: t('enrollment.exited'), count: enrollments.length - stats.active },
              { key: 'all', label: t('common.all'), count: enrollments.length },
            ]} className="mb-3" />
          <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
            <div className="relative mb-3">
              <label htmlFor="roster-search" className="sr-only">{t('roster.search')}</label>
              <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hv-gray" />
              <input ref={searchRef} id="roster-search" type="search" value={search}
                placeholder={t(isFamily ? 'roster.search_families_placeholder' : 'roster.search_placeholder')}
                onChange={event => updateParams({ q: event.target.value })}
                className={`${FIELD} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`} />
              {search && (
                <button type="button" aria-label={t('roster.clear_search')}
                  onClick={() => { updateParams({ q: null }); searchRef.current?.focus(); }}
                  className={`absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg text-hv-gray hover:text-hv-green ${FOCUS}`}>
                  <X aria-hidden="true" size={18} />
                </button>
              )}
            </div>
            {hasRosterError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-hv-crisis">
                <p>{t('roster.load_failed')}</p>
                <button type="button" className={`mt-2 min-h-11 rounded px-2 underline ${FOCUS}`}
                  onClick={() => { void enrollmentsQuery.refetch(); void subjectsQuery.refetch(); if (needsVisitDetail) void visitsQuery.refetch(); }}>
                  {t('roster.retry')}
                </button>
              </div>
            ) : (
              <ProgramRosterTable kind={program.kind} rows={visibleRows} visitIntervalDays={program.visitIntervalDays}
                variant={tab} isLoading={isLoading} emptyMessage={filtersActive ? t('roster.no_matches') : t('roster.empty')} />
            )}
            {!isLoading && !hasRosterError && (
              <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
                <p role="status" className="text-xs text-hv-gray">{countLabel}</p>
                {filteredRows.length > ROWS_PER_PAGE && (
                  <div className="flex gap-2">
                    <button type="button" disabled={currentPage === 0} onClick={() => updateParams({ page: String(currentPage - 1) })}
                      className={`min-h-11 rounded-lg border border-hv-border px-3 text-sm text-hv-green hover:bg-[#eaf0e9] disabled:opacity-50 ${FOCUS}`}>{t('common.previous')}</button>
                    <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => updateParams({ page: String(currentPage + 1) })}
                      className={`min-h-11 rounded-lg border border-hv-border px-3 text-sm text-hv-green hover:bg-[#eaf0e9] disabled:opacity-50 ${FOCUS}`}>{t('common.next')}</button>
                  </div>
                )}
              </footer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProgramRosterPage;
