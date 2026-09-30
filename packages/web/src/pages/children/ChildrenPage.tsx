import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ageInDays, type ChildRead } from '@naru/shared';
import { childrenApi } from '../../api/children';
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

export const ChildrenPage: React.FC = () => {
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
    queryKey: ['children', params],
    queryFn: () => childrenApi.listChildren(params),
  });

  const partialSiteFilter = Boolean(filters.siteId) && !filters.communityId;

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!partialSiteFilter) return items;
    return items.filter(
      (child) =>
        child.communityId !== null && siteOfCommunity.get(child.communityId) === filters.siteId
    );
  }, [data, partialSiteFilter, siteOfCommunity, filters.siteId]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (next: FilterValues) => {
    const siteChanged = next.siteId !== filters.siteId;
    const communityStillValid =
      !siteChanged || !next.communityId || siteOfCommunity.get(next.communityId) === next.siteId;
    setFilters({
      ...next,
      communityId: communityStillValid ? next.communityId ?? null : null,
    });
    setPage(0);
  };

  const sexLabel = (sex: ChildRead['sex']): string =>
    sex === 'MALE' ? t('subject.sex_male') : t('subject.sex_female');

  const placeFor = (child: ChildRead) => ({
    community: child.communityId ? communityTitle.get(child.communityId) ?? '—' : '—',
    site:
      child.communityId && siteOfCommunity.get(child.communityId)
        ? siteTitle.get(siteOfCommunity.get(child.communityId) as number) ?? '—'
        : '—',
  });

  return (
    <div>
      <PageHeader
        title={t('nav.children')}
        actions={
          <Link
            to="/children/new"
            className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
          >
            {t('common.add_child')}
          </Link>
        }
      />

      <div className="space-y-3 mb-6">
        <div>
          <label htmlFor="child-search" className="block text-sm font-medium text-hv-gray mb-1">
            {t('subject.search')}
          </label>
          <input
            id="child-search"
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
          <p className="text-hv-crisis">{t('children.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && rows.length === 0 && <EmptyState message={t('children.empty')} />}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
            <table className="min-w-full divide-y divide-hv-border">
              <thead className="bg-hv-page">
                <tr>
                  <th className={TH}>{t('subject.col_name')}</th>
                  <th className={TH}>{t('subject.col_age')}</th>
                  <th className={TH}>{t('subject.col_sex')}</th>
                  <th className={TH}>{t('subject.col_community')}</th>
                  <th className={TH}>{t('subject.col_site')}</th>
                  <th className={TH}>{t('subject.col_mother')}</th>
                  <th className={TH}>{t('subject.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border">
                {rows.map((child) => {
                  const place = placeFor(child);
                  return (
                    <tr key={child.id} className="hover:bg-hv-page">
                      <td className={TD}>
                        <Link
                          to={`/children/${child.id}`}
                          className="font-medium text-hv-terracotta hover:underline"
                        >
                          {child.name}
                        </Link>
                      </td>
                      <td className={TD}>{ageLabel(child.birthDate)}</td>
                      <td className={TD}>{sexLabel(child.sex)}</td>
                      <td className={TD}>{place.community}</td>
                      <td className={TD}>{place.site}</td>
                      <td className={TD}>
                        {child.motherId ? (
                          <Link
                            to={`/mothers/${child.motherId}`}
                            className="text-hv-terracotta hover:underline"
                          >
                            {t('children.view_mother')}
                          </Link>
                        ) : (
                          <span className="text-hv-gray">{t('children.no_mother')}</span>
                        )}
                      </td>
                      <td className={TD}>
                        <Link
                          to={`/children/${child.id}/edit`}
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
            {rows.map((child) => {
              const place = placeFor(child);
              return (
                <li key={child.id} className="bg-white p-4 rounded-xl border border-hv-border">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to={`/children/${child.id}`}
                      className="font-medium text-hv-terracotta hover:underline"
                    >
                      {child.name}
                    </Link>
                    <Link
                      to={`/children/${child.id}/edit`}
                      className="text-sm text-hv-terracotta hover:underline shrink-0"
                    >
                      {t('common.edit')}
                    </Link>
                  </div>
                  <p className="text-sm text-hv-gray mt-1">
                    {ageLabel(child.birthDate)} · {sexLabel(child.sex)} · {place.community} (
                    {place.site})
                  </p>
                  {!child.motherId && (
                    <p className="text-sm text-hv-gray">{t('children.no_mother')}</p>
                  )}
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

export default ChildrenPage;
