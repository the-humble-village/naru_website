import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, SlidersHorizontal, UserRound, UsersRound, X } from 'lucide-react';
import type { LocationType, NutritionalStatus, TranslationKey, VisitListItem } from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';
import { EmptyState, LoadingState, SubjectTypeBadge, type FilterValues } from '../../components';
import { useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';

const PAGE_SIZE = 25;
const TH = 'px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-hv-green';
const TD = 'px-3 py-4 text-sm text-hv-charcoal';
const FIELD = 'min-h-11 w-full min-w-0 rounded-lg border border-hv-border bg-white px-3 py-2 text-sm text-hv-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green';
const FOCUS = 'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';

const LOCATION_KEY: Record<LocationType, TranslationKey> = {
  SITE: 'visit.location_site',
  HOME: 'visit.location_home',
  MOBILE_CLINIC: 'visit.location_mobile_clinic',
};
const STATUS_KEY: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutrition.severe',
  MODERATE: 'nutrition.moderate',
  MILD: 'nutrition.mild',
  NORMAL: 'nutrition.normal',
};
const STATUS_COLOR: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-100 text-red-800',
  MODERATE: 'bg-orange-100 text-orange-800',
  MILD: 'bg-amber-100 text-amber-800',
  NORMAL: 'bg-green-100 text-green-800',
};

export const VisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterValues>({
    dateFrom: null, dateTo: null, siteId: null, programId: null, communityId: null,
  });
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const normalized = search.trim().replace(/\s+/g, ' ');
    if (normalized === query) return;
    const timeout = window.setTimeout(() => {
      setQuery(normalized);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, query]);

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: communities = [] } = useQuery({
    queryKey: ['communities'], queryFn: adminApi.fetchCommunities,
  });
  const { data: programs } = useQuery({
    queryKey: ['programs'], queryFn: () => programsApi.listPrograms(),
  });
  const siteTitle = useMemo(() => new Map(sites.map(site => [site.id, site.title])), [sites]);
  const communityTitle = useMemo(
    () => new Map(communities.map(community => [community.id, community.title])), [communities]
  );
  const communityOptions = communities.filter(
    community => !filters.siteId || community.siteId === filters.siteId
  );
  const params = useMemo(() => ({
    programId: filters.programId ?? undefined,
    siteId: filters.siteId ?? undefined,
    communityId: filters.communityId ?? undefined,
    from: filters.dateFrom ?? undefined,
    to: filters.dateTo ?? undefined,
    search: query || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  }), [filters, page, query]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['visits', params],
    queryFn: () => visitsApi.listVisits(params),
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(query || Object.values(filters).some(Boolean));

  const handleFilterChange = (next: FilterValues): void => {
    const siteChanged = next.siteId !== filters.siteId;
    const stillValid =
      !siteChanged || !next.siteId || !next.communityId ||
      communities.find(community => community.id === next.communityId)?.siteId === next.siteId;
    setFilters({ ...next, communityId: stillValid ? next.communityId ?? null : null });
    setPage(0);
  };

  const placeOf = (visit: VisitListItem) =>
    (visit.communityId !== null ? communityTitle.get(visit.communityId) : undefined) ??
    (visit.siteId !== null ? siteTitle.get(visit.siteId) : undefined);

  const visitLabel = (visit: VisitListItem) =>
    t('visit.open_visit').replace('{name}', visit.subjectName ?? t('common.unnamed'))
      .replace('{date}', formatDateUTC(visit.visitDate));

  const measurementOf = (visit: VisitListItem): React.ReactNode => {
    const weight = visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null;
    const status = visit.nutritionDetail?.nutritionalStatus ?? null;
    if (weight === null && status === null) return '—';
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {weight !== null && <span className="whitespace-nowrap tabular-nums">{weight} kg</span>}
        {status !== null && (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
            {t(STATUS_KEY[status])}
          </span>
        )}
      </span>
    );
  };
  const selectFields = [
    { key: 'siteId' as const, label: 'filter.site' as const, all: 'visit.all_sites' as const, options: sites },
    { key: 'programId' as const, label: 'filter.program' as const, all: 'visit.all_programs' as const,
      options: (programs?.items ?? []).map(program => ({ id: program.id, title: program.name })) },
    { key: 'communityId' as const, label: 'filter.community' as const, all: 'visit.all_communities' as const,
      options: communityOptions },
  ];

  return (
    <div className="mx-auto max-w-7xl py-1">
      <header className="mb-5 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green sm:text-4xl">
          {t('visit.all_visits')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray sm:text-base">
          {t('visit.list_description')}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[208px_minmax(0,1fr)] xl:grid-cols-[224px_minmax(0,1fr)]">
        <aside aria-labelledby="visit-filters-heading" className="min-w-0 rounded-2xl border border-hv-green/15 bg-[#eaf0e9] p-4 lg:self-start">
          <h2 id="visit-filters-heading" className="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-hv-green">
            <SlidersHorizontal aria-hidden="true" size={22} className="shrink-0 text-hv-terracotta" />
            {t('visit.filter_visits')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {([
              { key: 'dateFrom', label: 'filter.date_from' },
              { key: 'dateTo', label: 'filter.date_to' },
            ] as const).map(field => (
              <div key={field.key} className="min-w-0">
                <label htmlFor={`visit-${field.key}`} className="mb-1 block text-sm font-medium text-hv-gray">
                  {t(field.label)}
                </label>
                <input
                  id={`visit-${field.key}`} type="date"
                  value={filters[field.key] ?? ''}
                  min={field.key === 'dateTo' ? filters.dateFrom ?? undefined : undefined}
                  max={field.key === 'dateFrom' ? filters.dateTo ?? undefined : undefined}
                  onChange={event => handleFilterChange({ ...filters, [field.key]: event.target.value || null })}
                  className={FIELD}
                />
              </div>
            ))}
            {selectFields.map(field => (
              <div key={field.key} className="min-w-0">
                <label htmlFor={`visit-${field.key}`} className="mb-1 block text-sm font-medium text-hv-gray">
                  {t(field.label)}
                </label>
                <select
                  id={`visit-${field.key}`} value={filters[field.key] ?? ''}
                  onChange={event => handleFilterChange({
                    ...filters, [field.key]: event.target.value ? Number(event.target.value) : null,
                  })}
                  className={FIELD}
                >
                  <option value="">{t(field.all)}</option>
                  {field.options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
              </div>
            ))}
          </div>
        </aside>

        <section aria-label={t('visit.history')} className="min-w-0 rounded-2xl border border-hv-border bg-white p-3 sm:p-4">
          <div role="search" aria-label={t('visit.search_label')} className="relative mb-4">
            <label htmlFor="visit-search" className="sr-only">{t('visit.search_label')}</label>
            <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hv-gray" />
            <input
              ref={searchRef} id="visit-search" type="search" maxLength={120}
              placeholder={t('visit.search_placeholder')} value={search}
              onChange={event => setSearch(event.target.value)}
              className={`${FIELD} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`}
            />
            {search && (
              <button type="button" aria-label={t('visit.clear_search')}
                onClick={() => { setSearch(''); setQuery(''); setPage(0); searchRef.current?.focus(); }}
                className={`absolute right-0 top-0 flex h-full w-11 items-center justify-center text-hv-gray hover:text-hv-green ${FOCUS}`}>
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>

          <div aria-busy={isFetching}>
            {isLoading && <LoadingState message={t('common.loading')} />}
            {isError && (
              <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-hv-crisis">
                {t('visit.load_failed')}
              </div>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <EmptyState message={t(hasFilters ? 'visit.no_matches' : 'visit.empty')} />
            )}
            {!isLoading && !isError && rows.length > 0 && (
              <>
                <div className="hidden overflow-hidden rounded-xl border border-hv-border xl:block">
                  <table className="w-full table-fixed divide-y divide-hv-border">
                    <caption className="sr-only">{t('visit.history')}</caption>
                    <thead className="bg-[#eaf0e9]">
                      <tr>
                        <th scope="col" className={`${TH} w-[24%]`}>{t('visit.col_visit')}</th>
                        <th scope="col" className={`${TH} w-[18%]`}>{t('visit.col_program')}</th>
                        <th scope="col" className={`${TH} w-[23%]`}>{t('visit.col_location')}</th>
                        <th scope="col" className={`${TH} w-[15%]`}>{t('visit.col_recorded_by')}</th>
                        <th scope="col" className={`${TH} w-[16%]`}>{t('visit.col_measurement')}</th>
                        <th scope="col" className="w-[4%]"><span className="sr-only">{t('visit.details')}</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hv-border">
                      {rows.map(visit => {
                        const Icon = visit.program.subjectType === 'FAMILY' ? UsersRound : UserRound;
                        return (
                          <tr key={visit.id} className="hover:bg-hv-page focus-within:bg-hv-page">
                            <td className={TD}>
                              <div className="flex items-center gap-3">
                                <Icon aria-hidden="true" size={22} className="shrink-0 text-hv-terracotta" />
                                <div className="min-w-0">
                                  <Link to={`/enrollments/${visit.enrollmentId}`} className={`break-words font-semibold hover:text-hv-green hover:underline ${FOCUS}`}>
                                    {visit.subjectName ?? t('common.unnamed')}
                                  </Link>
                                  <Link to={`/visits/${visit.id}`} className={`mt-1 block w-fit text-xs text-hv-gray hover:text-hv-green hover:underline ${FOCUS}`}>
                                    {formatDateUTC(visit.visitDate)}
                                  </Link>
                                </div>
                              </div>
                            </td>
                            <td className={`${TD} break-words`}>{visit.program.name}</td>
                            <td className={`${TD} break-words`}>
                              <span className="block text-xs text-hv-gray">{t(LOCATION_KEY[visit.locationType])}</span>
                              {placeOf(visit)}
                            </td>
                            <td className={`${TD} break-words text-hv-gray`}>{visit.recordedByName?.trim() || t('visit.not_recorded')}</td>
                            <td className={TD}>{measurementOf(visit)}</td>
                            <td className="pr-1">
                              <Link to={`/visits/${visit.id}`} aria-label={visitLabel(visit)}
                                className={`flex min-h-11 items-center justify-center text-hv-green ${FOCUS}`}>
                                <ChevronRight aria-hidden="true" size={18} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:hidden">
                  {rows.map(visit => (
                    <li key={visit.id} className="min-w-0 rounded-xl border border-hv-green/15 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link to={`/enrollments/${visit.enrollmentId}`} className={`font-semibold text-hv-charcoal hover:underline ${FOCUS}`}>
                            {visit.subjectName ?? t('common.unnamed')}
                          </Link>
                          <Link to={`/visits/${visit.id}`} className={`mt-1 block w-fit text-sm text-hv-gray hover:underline ${FOCUS}`}>
                            {formatDateUTC(visit.visitDate)}
                          </Link>
                        </div>
                        <SubjectTypeBadge type={visit.program.subjectType} />
                      </div>
                      <p className="mt-3 text-sm text-hv-charcoal">{visit.program.name}</p>
                      <p className="mt-1 text-sm text-hv-gray">
                        {[t(LOCATION_KEY[visit.locationType]), placeOf(visit)].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-sm text-hv-gray">
                        {t('visit.recorded_by')}: {visit.recordedByName?.trim() || t('visit.not_recorded')}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <div>{measurementOf(visit)}</div>
                        <Link to={`/visits/${visit.id}`} aria-label={visitLabel(visit)}
                          className={`flex h-11 w-11 items-center justify-center text-hv-green ${FOCUS}`}>
                          <ChevronRight aria-hidden="true" size={18} />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-hv-gray">
                    {t('common.page')} {page + 1} {t('common.of')} {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage(current => Math.max(0, current - 1))}
                      disabled={page === 0 || isFetching}
                      className={`min-h-11 rounded-lg border border-hv-border px-3 py-2 text-sm text-hv-charcoal hover:bg-hv-page disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
                      {t('common.previous')}
                    </button>
                    <button type="button" onClick={() => setPage(current => current + 1)}
                      disabled={page + 1 >= totalPages || isFetching}
                      className={`min-h-11 rounded-lg border border-hv-border px-3 py-2 text-sm text-hv-charcoal hover:bg-hv-page disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
                      {t('common.next')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default VisitsPage;
