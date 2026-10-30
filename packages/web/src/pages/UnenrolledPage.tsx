import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUBJECT_FK, type SubjectType } from '@naru/shared';
import { mothersApi } from '../api/mothers';
import { childrenApi } from '../api/children';
import { peopleApi } from '../api/people';
import { familiesApi } from '../api/families';
import { programsApi } from '../api/programs';
import { dashboardApi } from '../api/dashboard';
import { adminApi } from '../api/admin';
import { EmptyState, LoadingState, SubjectTypeBadge, Tabs, type FilterValues } from '../components';
import { useTranslation } from '../hooks';
import { DirectoryHeader, DirectoryFilters, DirectoryPanel, DirectoryTable, DirectoryNameLink, DirectoryPagination, directoryCount, DIRECTORY_FIELD, type DirectoryColumn } from '../components/people/PeopleDirectory';

const PAGE_SIZE = 25;

type TabKey = 'ALL' | 'MOTHER' | 'CHILD' | 'PERSON' | 'FAMILY';

interface WorklistRow {
  type: SubjectType;
  id: number;
  name: string;
  communityId: number | null;
  siteId?: number | null;
}

const profilePath = (row: WorklistRow): string => {
  switch (row.type) {
    case 'MOTHER':
      return `/mothers/${row.id}`;
    case 'CHILD':
      return `/children/${row.id}`;
    case 'PERSON':
      return `/people/${row.id}`;
    case 'FAMILY':
      return `/families/${row.id}`;
  }
};

export const UnenrolledPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('ALL');
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ siteId: null, communityId: null });

  // Coming back here after enrolling someone should not show a stale sidebar
  // badge, and the worklist is exactly where a worker returns.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
  }, [queryClient]);

  const { data: counts } = useQuery({
    queryKey: ['unenrolled-count'],
    queryFn: dashboardApi.fetchUnenrolledCount,
  });

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: programs } = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => programsApi.listPrograms({ activeOnly: true }),
  });

  const listParams = { unenrolled: true, search: search.trim() || undefined, siteId: filters.siteId ?? undefined, communityId: filters.communityId ?? undefined, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

  const wantMothers = tab === 'ALL' || tab === 'MOTHER';
  const wantChildren = tab === 'ALL' || tab === 'CHILD';
  const wantPeople = tab === 'ALL' || tab === 'PERSON';
  const wantFamilies = tab === 'ALL' || tab === 'FAMILY';

  const mothersQuery = useQuery({
    queryKey: ['mothers', listParams],
    queryFn: () => mothersApi.listMothers(listParams),
    enabled: wantMothers,
  });
  const childrenQuery = useQuery({
    queryKey: ['children', listParams],
    queryFn: () => childrenApi.listChildren(listParams),
    enabled: wantChildren,
  });
  const peopleQuery = useQuery({
    queryKey: ['people', listParams],
    queryFn: () => peopleApi.listPeople(listParams),
    enabled: wantPeople,
  });
  const familiesQuery = useQuery({
    queryKey: ['families', listParams],
    queryFn: () => familiesApi.listFamilies(listParams),
    enabled: wantFamilies,
  });

  const communityTitle = useMemo(() => {
    const map = new Map<number, string>();
    communities.forEach((community) => map.set(community.id, community.title));
    return map;
  }, [communities]);

  const siteTitleOfCommunity = useMemo(() => {
    const siteNames = new Map<number, string>();
    sites.forEach((site) => siteNames.set(site.id, site.title));
    const map = new Map<number, string>();
    communities.forEach((community) => {
      if (community.siteId) {
        map.set(community.id, siteNames.get(community.siteId) ?? t('common.unknown'));
      }
    });
    return map;
  }, [communities, sites, t]);

  const rows: WorklistRow[] = useMemo(() => {
    const collected: WorklistRow[] = [];
    if (wantMothers) {
      (mothersQuery.data?.items ?? []).forEach((mother) =>
        collected.push({
          type: 'MOTHER',
          id: mother.id,
          name: mother.name,
          communityId: mother.communityId,
        })
      );
    }
    if (wantChildren) {
      (childrenQuery.data?.items ?? []).forEach((child) =>
        collected.push({
          type: 'CHILD',
          id: child.id,
          name: child.name,
          communityId: child.communityId,
        })
      );
    }
    if (wantPeople) {
      (peopleQuery.data?.items ?? []).forEach((person) =>
        collected.push({
          type: 'PERSON',
          id: person.id,
          name: person.name,
          communityId: person.communityId,
        })
      );
    }
    if (wantFamilies) {
      (familiesQuery.data?.families ?? []).forEach((family) =>
        collected.push({
          type: 'FAMILY',
          id: family.id,
          name: family.familyName || t('common.unnamed'),
          communityId: family.communityId,
          siteId: family.siteId,
        })
      );
    }
    return collected;
  }, [
    wantMothers,
    wantChildren,
    wantPeople,
    wantFamilies,
    mothersQuery.data,
    childrenQuery.data,
    peopleQuery.data,
    familiesQuery.data,
    t,
  ]);

  const pagesFor = (total: number | undefined) => Math.ceil((total ?? 0) / PAGE_SIZE);
  const totalPages = Math.max(
    1,
    Math.max(
      wantMothers ? pagesFor(mothersQuery.data?.total) : 0,
      wantChildren ? pagesFor(childrenQuery.data?.total) : 0,
      wantPeople ? pagesFor(peopleQuery.data?.total) : 0,
      wantFamilies ? pagesFor(familiesQuery.data?.total) : 0
    )
  );

  const isLoading =
    (wantMothers && mothersQuery.isLoading) ||
    (wantChildren && childrenQuery.isLoading) ||
    (wantPeople && peopleQuery.isLoading) ||
    (wantFamilies && familiesQuery.isLoading);

  const programsFor = (type: SubjectType) =>
    (programs?.items ?? []).filter((program) => program.subjectType === type);

  const handleEnroll = (row: WorklistRow, programId: string) => {
    if (!programId) return;
    navigate(`/programs/${programId}/enroll?${SUBJECT_FK[row.type]}=${row.id}`);
  };

  const tabs = [
    { key: 'ALL', label: t('unenrolled.tab_all'), count: counts?.total },
    { key: 'MOTHER', label: t('nav.mothers'), count: counts?.mothers },
    { key: 'CHILD', label: t('nav.children'), count: counts?.children },
    { key: 'PERSON', label: t('nav.persons'), count: counts?.people },
    { key: 'FAMILY', label: t('nav.families'), count: counts?.families },
  ];

  const enrollControl = (row: WorklistRow) => {
    const options = programsFor(row.type);
    if (options.length === 0) {
      return <span className="text-sm text-hv-gray">{t('unenrolled.no_program')}</span>;
    }
    return (
      <select
        aria-label={`${t('unenrolled.enroll')}: ${row.name}`}
        value=""
        onChange={(event) => handleEnroll(row, event.target.value)}
        className={`${DIRECTORY_FIELD} max-w-full md:w-auto`}
      >
        <option value="">{t('unenrolled.enroll')}</option>
        {options.map((program) => (
          <option key={program.id} value={String(program.id)}>
            {program.name}
          </option>
        ))}
      </select>
    );
  };

  const total = (wantMothers ? mothersQuery.data?.total ?? 0 : 0)
    + (wantChildren ? childrenQuery.data?.total ?? 0 : 0)
    + (wantPeople ? peopleQuery.data?.total ?? 0 : 0)
    + (wantFamilies ? familiesQuery.data?.total ?? 0 : 0);
  const isError = (wantMothers && mothersQuery.isError) || (wantChildren && childrenQuery.isError)
    || (wantPeople && peopleQuery.isError) || (wantFamilies && familiesQuery.isError);
  const filtersActive = search.trim() !== '' || filters.siteId != null || filters.communityId != null;
  const nameLink = (row: WorklistRow) => <DirectoryNameLink to={profilePath(row)}>{row.name}</DirectoryNameLink>;
  const columns: DirectoryColumn<WorklistRow>[] = [
    { key: 'name', label: t('subject.col_name'), render: nameLink },
    { key: 'type', label: t('subject.col_type'), render: row => <SubjectTypeBadge type={row.type} /> },
    { key: 'community', label: t('subject.col_community'), render: row => row.communityId ? communityTitle.get(row.communityId) ?? t('common.unknown') : t('unenrolled.no_community') },
    { key: 'site', label: t('subject.col_site'), render: row => row.siteId
      ? sites.find(site => site.id === row.siteId)?.title ?? t('common.unknown')
      : row.communityId ? siteTitleOfCommunity.get(row.communityId) ?? '—' : '—' },
    { key: 'actions', label: t('subject.col_actions'), render: enrollControl },
  ];

  return (
    <div className="mx-auto max-w-screen-2xl py-1">
      <DirectoryHeader title={t('nav.unenrolled')} description={t('directory.unenrolled_description')} />
      <DirectoryFilters search={search} searchLabel={t('directory.search_unenrolled')}
        onSearchChange={value => { setSearch(value); setPage(0); }} value={filters}
        onChange={value => {
          const communityValid = !value.siteId || communities.find(community => community.id === value.communityId)?.siteId === value.siteId;
          setFilters({ ...value, communityId: communityValid ? value.communityId ?? null : null });
          setPage(0);
        }} sites={sites} communities={communities.filter(community => !filters.siteId || community.siteId === filters.siteId)}
        onClear={() => { setSearch(''); setFilters({ siteId: null, communityId: null }); setPage(0); }} />
      <DirectoryPanel title={isLoading || isError ? t('nav.unenrolled') : directoryCount(t, 'unenrolled', total)}>
        <Tabs tabs={tabs} value={tab} onChange={key => { setTab(key as TabKey); setPage(0); }} label={t('nav.unenrolled')} className="mb-4" />
        <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {isLoading && <LoadingState message={t('common.loading')} />}
          {isError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-hv-crisis">{t('directory.unenrolled_load_failed')}</div>}
          {!isLoading && !isError && rows.length === 0 && <EmptyState message={t(filtersActive ? 'directory.no_matches' : 'unenrolled.empty')} />}
          {!isLoading && !isError && rows.length > 0 && (
            <DirectoryTable rows={rows} columns={columns} rowKey={row => `${row.type}-${row.id}`} rowTitle={nameLink} label={t('nav.unenrolled')} mobileActionBelow />
          )}
          {!isLoading && !isError && (
            <DirectoryPagination page={page} totalPages={totalPages} onPageChange={setPage}
              resultText={t('directory.page_records').replace('{count}', String(rows.length))} />
          )}
        </div>
      </DirectoryPanel>
    </div>
  );
};

export default UnenrolledPage;
