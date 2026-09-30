import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LocationType, NutritionalStatus, TranslationKey, VisitListItem } from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';
import {
  EmptyState,
  FilterBar,
  LoadingState,
  PageHeader,
  SubjectTypeBadge,
  type FilterValues,
} from '../../components';
import { useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';

const PAGE_SIZE = 25;

const TH = 'px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';
const TD = 'px-4 py-3 text-sm text-hv-charcoal';

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
  SEVERE: 'bg-red-600 text-white',
  MODERATE: 'bg-red-400 text-white',
  MILD: 'bg-yellow-500 text-white',
  NORMAL: 'bg-green-500 text-white',
};

export const VisitsPage: React.FC = () => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FilterValues>({
    dateFrom: null,
    dateTo: null,
    siteId: null,
    programId: null,
    communityId: null,
  });
  const [page, setPage] = useState(0);

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.listPrograms(),
  });

  const siteTitle = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((site) => map.set(site.id, site.title));
    return map;
  }, [sites]);

  const communityTitle = useMemo(() => {
    const map = new Map<number, string>();
    communities.forEach((community) => map.set(community.id, community.title));
    return map;
  }, [communities]);

  const communityOptions = useMemo(
    () =>
      communities
        .filter((community) => !filters.siteId || (community.siteId ?? null) === filters.siteId)
        .map((community) => ({ id: community.id, title: community.title })),
    [communities, filters.siteId]
  );

  const params = useMemo(
    () => ({
      programId: filters.programId ?? undefined,
      siteId: filters.siteId ?? undefined,
      communityId: filters.communityId ?? undefined,
      from: filters.dateFrom ?? undefined,
      to: filters.dateTo ?? undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [filters, page]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['visits', params],
    queryFn: () => visitsApi.listVisits(params),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (next: FilterValues): void => {
    const siteChanged = next.siteId !== filters.siteId;
    const stillValid =
      !siteChanged ||
      !next.communityId ||
      (communities.find((community) => community.id === next.communityId)?.siteId ?? null) ===
        next.siteId;
    setFilters({ ...next, communityId: stillValid ? next.communityId ?? null : null });
    setPage(0);
  };

  const placeOf = (visit: VisitListItem): string => {
    const parts = [t(LOCATION_KEY[visit.locationType])];
    const where =
      (visit.communityId !== null ? communityTitle.get(visit.communityId) : undefined) ??
      (visit.siteId !== null ? siteTitle.get(visit.siteId) : undefined);
    if (where) parts.push(where);
    return parts.join(' · ');
  };

  const measurementOf = (visit: VisitListItem): React.ReactNode => {
    const weight = visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null;
    const status = visit.nutritionDetail?.nutritionalStatus ?? null;
    if (weight === null && status === null) return '—';

    return (
      <span className="inline-flex items-center gap-2">
        {weight !== null && <span className="tabular-nums">{weight} kg</span>}
        {status !== null && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[status]}`}
          >
            {t(STATUS_KEY[status])}
          </span>
        )}
      </span>
    );
  };

  return (
    <div>
      <PageHeader title={t('visit.all_visits')} />

      <div className="mb-6">
        <FilterBar
          fields={['dateRange', 'site', 'program', 'community']}
          value={filters}
          onChange={handleFilterChange}
          sites={sites.map((site) => ({ id: site.id, title: site.title }))}
          programs={(programs?.items ?? []).map((program) => ({
            id: program.id,
            title: program.name,
          }))}
          communities={communityOptions}
        />
      </div>

      {isLoading && <LoadingState message={t('common.loading')} />}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-hv-crisis">{t('visit.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && <EmptyState message={t('visit.empty')} />}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
            <table className="min-w-full divide-y divide-hv-border">
              <thead className="bg-hv-page">
                <tr>
                  <th className={TH}>{t('visit.col_date')}</th>
                  <th className={TH}>{t('visit.col_subject')}</th>
                  <th className={TH}>{t('visit.col_program')}</th>
                  <th className={TH}>{t('visit.col_location')}</th>
                  <th className={TH}>{t('visit.col_recorded_by')}</th>
                  <th className={TH}>{t('visit.col_measurement')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border">
                {rows.map((visit) => (
                  <tr key={visit.id} className="hover:bg-hv-page">
                    <td className={TD}>
                      <Link
                        to={`/visits/${visit.id}`}
                        className="font-medium text-hv-terracotta hover:underline"
                      >
                        {formatDateUTC(visit.visitDate)}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Link
                        to={`/enrollments/${visit.enrollmentId}`}
                        className="text-hv-terracotta hover:underline"
                      >
                        {visit.subjectName ?? t('common.unnamed')}
                      </Link>
                    </td>
                    <td className={TD}>{visit.program.name}</td>
                    <td className={TD}>{placeOf(visit)}</td>
                    <td className={TD}>{visit.recordedByName ?? '—'}</td>
                    <td className={TD}>{measurementOf(visit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-3">
            {rows.map((visit) => (
              <li key={visit.id} className="bg-white p-4 rounded-xl border border-hv-border">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/visits/${visit.id}`}
                    className="font-medium text-hv-terracotta hover:underline"
                  >
                    {formatDateUTC(visit.visitDate)}
                  </Link>
                  <SubjectTypeBadge type={visit.program.subjectType} />
                </div>
                <p className="text-sm text-hv-charcoal mt-1">
                  <Link
                    to={`/enrollments/${visit.enrollmentId}`}
                    className="text-hv-terracotta hover:underline"
                  >
                    {visit.subjectName ?? t('common.unnamed')}
                  </Link>
                  {' · '}
                  {visit.program.name}
                </p>
                <p className="text-sm text-hv-gray">{placeOf(visit)}</p>
                <p className="text-sm text-hv-gray">
                  {t('visit.recorded_by')}: {visit.recordedByName ?? '—'}
                </p>
                <div className="mt-2 text-sm text-hv-charcoal">{measurementOf(visit)}</div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 mt-4">
            <span className="text-sm text-hv-gray">
              {t('common.page')} {page + 1} {t('common.of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                className="px-3 py-2 text-sm rounded-md border border-hv-border text-hv-charcoal hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.previous')}
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={page + 1 >= totalPages}
                className="px-3 py-2 text-sm rounded-md border border-hv-border text-hv-charcoal hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VisitsPage;
