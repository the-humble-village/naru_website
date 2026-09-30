import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ageInDays, type MotherRead } from '@naru/shared';
import { mothersApi } from '../../api/mothers';
import { adminApi } from '../../api/admin';
import {
  EmptyState,
  FilterBar,
  LoadingState,
  PageHeader,
  type FilterValues,
} from '../../components';
import { useTranslation } from '../../hooks';

const PAGE_SIZE = 25;

const TH = 'px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider';
const TD = 'px-4 py-3 text-sm text-hv-charcoal';

const ageLabel = (birthDate: string | null | undefined): string => {
  if (!birthDate) return '—';
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return '—';
  const days = ageInDays(date);
  if (days === null || days < 0) return '—';
  if (days < 61) return `${days}d`;
  const months = Math.floor(days / 30.4375);
  if (months < 24) return `${months}m`;
  return `${Math.floor(days / 365.25)}y`;
};

export const MothersPage: React.FC = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ siteId: null, communityId: null });
  const [page, setPage] = useState(0);

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });

  const siteOfCommunity = useMemo(() => {
    const map = new Map<number, number | null>();
    communities.forEach((community) => map.set(community.id, community.siteId ?? null));
    return map;
  }, [communities]);

  const communityTitle = useMemo(() => {
    const map = new Map<number, string>();
    communities.forEach((community) => map.set(community.id, community.title));
    return map;
  }, [communities]);

  const siteTitle = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((site) => map.set(site.id, site.title));
    return map;
  }, [sites]);

  const communityOptions = useMemo(
    () =>
      communities
        .filter((community) => !filters.siteId || (community.siteId ?? null) === filters.siteId)
        .map((community) => ({ id: community.id, title: community.title })),
    [communities, filters.siteId]
  );

  const siteOptions = useMemo(
    () => sites.map((site) => ({ id: site.id, title: site.title })),
    [sites]
  );

  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      communityId: filters.communityId ?? undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [search, filters.communityId, page]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mothers', params],
    queryFn: () => mothersApi.listMothers(params),
  });

  const partialSiteFilter = Boolean(filters.siteId) && !filters.communityId;

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!partialSiteFilter) return items;
    return items.filter(
      (mother) =>
        mother.communityId !== null && siteOfCommunity.get(mother.communityId) === filters.siteId
    );
  }, [data, partialSiteFilter, siteOfCommunity, filters.siteId]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (next: FilterValues) => {
    const siteChanged = next.siteId !== filters.siteId;
    const communityStillValid =
      !siteChanged ||
      !next.communityId ||
      siteOfCommunity.get(next.communityId) === next.siteId;
    setFilters({
      ...next,
      communityId: communityStillValid ? next.communityId ?? null : null,
    });
    setPage(0);
  };

  const placeFor = (mother: MotherRead) => ({
    community: mother.communityId ? communityTitle.get(mother.communityId) ?? '—' : '—',
    site:
      mother.communityId && siteOfCommunity.get(mother.communityId)
        ? siteTitle.get(siteOfCommunity.get(mother.communityId) as number) ?? '—'
        : '—',
  });

  return (
    <div>
      <PageHeader
        title={t('nav.mothers')}
        actions={
          <Link
            to="/mothers/new"
            className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
          >
            {t('mothers.add')}
          </Link>
        }
      />

      <div className="space-y-3 mb-6">
        <div>
          <label htmlFor="mother-search" className="block text-sm font-medium text-hv-gray mb-1">
            {t('subject.search')}
          </label>
          <input
            id="mother-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={t('subject.search_placeholder')}
            className="w-full md:max-w-sm px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
          />
        </div>

        <FilterBar
          fields={['site', 'community']}
          value={filters}
          onChange={handleFilterChange}
          sites={siteOptions}
          communities={communityOptions}
        />

        {partialSiteFilter && (
          <p className="text-sm text-hv-gray">{t('subject.site_filter_hint')}</p>
        )}
      </div>

      {isLoading && <LoadingState message={t('common.loading')} />}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-hv-crisis">{t('mothers.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState message={t('mothers.empty')} />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
            <table className="min-w-full divide-y divide-hv-border">
              <thead className="bg-hv-page">
                <tr>
                  <th className={TH}>{t('subject.col_name')}</th>
                  <th className={TH}>{t('subject.col_age')}</th>
                  <th className={TH}>{t('subject.col_community')}</th>
                  <th className={TH}>{t('subject.col_site')}</th>
                  <th className={TH}>{t('subject.col_phone')}</th>
                  <th className={TH}>{t('subject.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border">
                {rows.map((mother) => {
                  const place = placeFor(mother);
                  return (
                    <tr key={mother.id} className="hover:bg-hv-page">
                      <td className={TD}>
                        <Link
                          to={`/mothers/${mother.id}`}
                          className="font-medium text-hv-terracotta hover:underline"
                        >
                          {mother.name}
                        </Link>
                      </td>
                      <td className={TD}>{ageLabel(mother.birthDate)}</td>
                      <td className={TD}>{place.community}</td>
                      <td className={TD}>{place.site}</td>
                      <td className={TD}>{mother.phone || '—'}</td>
                      <td className={TD}>
                        <Link
                          to={`/mothers/${mother.id}/edit`}
                          className="text-hv-terracotta hover:underline"
                        >
                          {t('common.edit')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-3">
            {rows.map((mother) => {
              const place = placeFor(mother);
              return (
                <li
                  key={mother.id}
                  className="bg-white p-4 rounded-xl border border-hv-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/mothers/${mother.id}`}
                      className="font-medium text-hv-terracotta hover:underline"
                    >
                      {mother.name}
                    </Link>
                    <Link
                      to={`/mothers/${mother.id}/edit`}
                      className="text-sm text-hv-terracotta hover:underline shrink-0"
                    >
                      {t('common.edit')}
                    </Link>
                  </div>
                  <p className="text-sm text-hv-gray mt-1">
                    {ageLabel(mother.birthDate)} · {place.community} ({place.site})
                  </p>
                  {mother.phone && <p className="text-sm text-hv-gray">{mother.phone}</p>}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 mt-4">
            <span className="text-sm text-hv-gray">
              {t('common.page')} {page + 1} {t('common.of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-2 text-sm rounded-md border border-hv-border text-hv-charcoal hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('common.previous')}
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
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

export default MothersPage;
