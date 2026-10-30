import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MotherRead } from '@naru/shared';
import { mothersApi } from '../../api/mothers';
import { adminApi } from '../../api/admin';
import { EmptyState, LoadingState, type FilterValues } from '../../components';
import { DirectoryHeader, DirectoryFilters, DirectoryPanel, DirectoryTable, DirectoryNameLink, DirectoryEditLink, DirectoryPagination, directoryCount, formatDirectoryAge, type DirectoryColumn } from '../../components/people/PeopleDirectory';
import { useTranslation } from '../../hooks';

const PAGE_SIZE = 25;

export const MothersPage: React.FC = () => {
  const { t, lang } = useTranslation();
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
      siteId: filters.siteId ?? undefined,
      communityId: filters.communityId ?? undefined,
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [search, filters.siteId, filters.communityId, page]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['mothers', params],
    queryFn: () => mothersApi.listMothers(params),
  });

  const rows = data?.items ?? [];

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleFilterChange = (next: FilterValues) => {
    const siteChanged = next.siteId !== filters.siteId;
    const communityStillValid =
      !siteChanged || !next.siteId ||
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

  const nameLink = (row: MotherRead) => <DirectoryNameLink to={`/mothers/${row.id}`}>{row.name}</DirectoryNameLink>;
  const columns: DirectoryColumn<MotherRead>[] = [
    { key: 'name', label: t('subject.col_name'), render: nameLink },
    { key: 'age', label: t('subject.col_age'), render: row => formatDirectoryAge(row.birthDate, lang) },
    { key: 'community', label: t('subject.col_community'), render: row => placeFor(row).community },
    { key: 'site', label: t('subject.col_site'), render: row => placeFor(row).site },
    { key: 'phone', label: t('subject.col_phone'), render: row => row.phone || <span className="text-hv-gray">{t('directory.not_recorded')}</span> },
    { key: 'actions', label: t('subject.col_actions'), render: row => <DirectoryEditLink to={`/mothers/${row.id}/edit`} /> },
  ];
  const filtersActive = search.trim() !== '' || filters.siteId != null || filters.communityId != null;
  const showing = t('roster.showing')
    .replace('{from}', String(rows.length ? page * PAGE_SIZE + 1 : 0))
    .replace('{to}', String(page * PAGE_SIZE + rows.length))
    .replace('{total}', String(total));

  return (
    <div className="mx-auto max-w-screen-2xl py-1">
      <DirectoryHeader title={t('nav.mothers')} description={t('directory.mothers_description')}
        action={{ to: '/mothers/new', label: t('mothers.add') }} />
      <DirectoryFilters search={search} searchLabel={t('directory.search_mothers')}
        onSearchChange={value => { setSearch(value); setPage(0); }}
        value={filters} onChange={handleFilterChange} sites={siteOptions} communities={communityOptions}
        onClear={() => { setSearch(''); setFilters({ siteId: null, communityId: null }); setPage(0); }} />
      <DirectoryPanel title={isLoading || isError ? t('nav.mothers') : directoryCount(t, 'mothers', total)}>
        {isLoading && <LoadingState message={t('common.loading')} />}
        {isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-hv-crisis">{t('mothers.load_failed')}</div>}
        {!isLoading && !isError && rows.length === 0 && <EmptyState message={t(filtersActive ? 'directory.no_matches' : 'mothers.empty')} />}
        {!isLoading && !isError && rows.length > 0 && (
          <DirectoryTable rows={rows} columns={columns} rowKey={row => row.id} rowTitle={nameLink} label={t('nav.mothers')} />
        )}
        {!isLoading && !isError && <DirectoryPagination page={page} totalPages={totalPages} onPageChange={setPage} resultText={showing} />}
      </DirectoryPanel>
    </div>
  );
};

export default MothersPage;
