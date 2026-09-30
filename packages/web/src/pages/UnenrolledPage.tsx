import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUBJECT_FK, type SubjectType } from '@naru/shared';
import { mothersApi } from '../api/mothers';
import { childrenApi } from '../api/children';
import { peopleApi } from '../api/people';
import { familiesApi } from '../api/families';
import { programsApi } from '../api/programs';
import { dashboardApi } from '../api/dashboard';
import { adminApi } from '../api/admin';
import { EmptyState, LoadingState, PageHeader, SubjectTypeBadge, Tabs } from '../components';
import { useTranslation } from '../hooks';

const PAGE_SIZE = 25;

type TabKey = 'ALL' | 'MOTHER' | 'CHILD' | 'PERSON' | 'FAMILY';

interface WorklistRow {
  type: SubjectType;
  id: number;
  name: string;
  communityId: number | null;
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

  const listParams = { unenrolled: true, skip: page * PAGE_SIZE, limit: PAGE_SIZE };

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
        className="px-3 py-2 text-sm bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
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

  const placeLabel = (row: WorklistRow) => {
    if (!row.communityId) return t('unenrolled.no_community');
    const community = communityTitle.get(row.communityId) ?? t('common.unknown');
    const site = siteTitleOfCommunity.get(row.communityId);
    return site ? `${community} (${site})` : community;
  };

  return (
    <div>
      <PageHeader title={t('nav.unenrolled')} />

      <p className="text-hv-gray mb-4 max-w-3xl">{t('unenrolled.intro')}</p>

      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(key) => {
          setTab(key as TabKey);
          setPage(0);
        }}
        label={t('nav.unenrolled')}
        className="mb-4"
      />

      {isLoading && <LoadingState message={t('common.loading')} />}

      {!isLoading && rows.length === 0 && <EmptyState message={t('unenrolled.empty')} />}

      {!isLoading && rows.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-hv-border overflow-x-auto">
            <table className="min-w-full divide-y divide-hv-border">
              <thead className="bg-hv-page">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('subject.col_type')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('subject.col_name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('subject.col_community')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('subject.col_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hv-border">
                {rows.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-hv-page">
                    <td className="px-4 py-3">
                      <SubjectTypeBadge type={row.type} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={profilePath(row)}
                        className="font-medium text-hv-terracotta hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-hv-charcoal">{placeLabel(row)}</td>
                    <td className="px-4 py-3">{enrollControl(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-3">
            {rows.map((row) => (
              <li
                key={`${row.type}-${row.id}`}
                className="bg-white p-4 rounded-xl border border-hv-border space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={profilePath(row)}
                    className="font-medium text-hv-terracotta hover:underline"
                  >
                    {row.name}
                  </Link>
                  <SubjectTypeBadge type={row.type} />
                </div>
                <p className="text-sm text-hv-gray">{placeLabel(row)}</p>
                {enrollControl(row)}
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

export default UnenrolledPage;
