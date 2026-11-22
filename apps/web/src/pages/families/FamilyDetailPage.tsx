import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentListItem } from '@naru/shared';
import { fetchFamily, deleteFamily } from '../../api/families';
import { listMothers } from '../../api/mothers';
import { listChildren } from '../../api/children';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import {
  ConfirmDialog,
  EmptyState,
  EnrollmentCard,
  LoadingState,
  PageHeader,
  RoleGate,
  formatSubjectAge,
} from '../../components';
import { useTranslation } from '../../hooks';

const CARD = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm';
const SELECT =
  'w-full sm:w-auto px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const ACTION =
  'bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors';
const DANGER = 'bg-hv-crisis text-white px-4 py-2 rounded hover:bg-red-700 transition-colors';

const byActiveThenDate = (a: EnrollmentListItem, b: EnrollmentListItem): number => {
  if (!a.exitedAt !== !b.exitedAt) {
    return a.exitedAt ? 1 : -1;
  }
  return b.enrolledAt.localeCompare(a.enrolledAt);
};

const MemberLink: React.FC<{ to: string; name: string; meta?: string | null }> = ({
  to,
  name,
  meta,
}) => (
  <li>
    <Link
      to={to}
      className="block rounded border border-hv-border bg-white p-3 hover:border-hv-accent transition-colors"
    >
      <span className="font-medium text-hv-green">{name}</span>
      {meta && <span className="ml-2 text-sm text-hv-gray">{meta}</span>}
    </Link>
  </li>
);

export const FamilyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const familyId = id ? parseInt(id, 10) : 0;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => fetchFamily(familyId),
    enabled: familyId > 0,
  });

  const mothersQuery = useQuery({
    queryKey: ['mothers', { familyId }],
    queryFn: () => listMothers({ familyId }),
    enabled: familyId > 0,
  });

  const childrenQuery = useQuery({
    queryKey: ['children', { familyId }],
    queryFn: () => listChildren({ familyId }),
    enabled: familyId > 0,
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', { familyId }],
    queryFn: () => listEnrollments({ familyId, limit: 100 }),
    enabled: familyId > 0,
  });

  const communitiesQuery = useQuery({ queryKey: ['communities'], queryFn: fetchCommunities });
  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites });
  const programsQuery = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => listPrograms({ activeOnly: true }),
  });

  const enrollments = useMemo(
    () => [...(enrollmentsQuery.data?.items ?? [])].sort(byActiveThenDate),
    [enrollmentsQuery.data]
  );

  const remove = useMutation({
    mutationFn: () => deleteFamily(familyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.removeQueries({ queryKey: ['family', familyId] });
      setConfirmOpen(false);
      navigate('/families');
    },
  });

  if (familyQuery.isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  const family = familyQuery.data;

  if (familyQuery.isError || !family) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('families.load_failed')}</p>
      </div>
    );
  }

  const community = communitiesQuery.data?.find((item) => item.id === family.communityId) ?? null;
  const site = sitesQuery.data?.find((item) => item.id === community?.siteId) ?? null;
  const mothers = mothersQuery.data?.items ?? [];
  const children = childrenQuery.data?.items ?? [];
  const memberCount = mothers.length + children.length;
  const enrollPrograms = (programsQuery.data?.items ?? []).filter(
    (program) => program.subjectType === 'FAMILY'
  );

  return (
    <div>
      <PageHeader
        title={family.familyName || t('common.unnamed')}
        backTo="/families"
        backLabel={t('nav.families')}
        actions={
          <>
            <Link to={`/families/${familyId}/edit`} className={ACTION}>
              {t('common.edit')}
            </Link>
            <RoleGate requiredRole="SUPERVISOR">
              <button type="button" onClick={() => setConfirmOpen(true)} className={DANGER}>
                {t('common.delete')}
              </button>
            </RoleGate>
          </>
        }
      />

      <div className={`${CARD} mb-6`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-hv-charcoal">
          <span className="text-hv-gray">
            {community?.title ?? t('form.none')}
            {site ? ` (${t('form.site')}: ${site.title})` : ''}
          </span>
          {family.phone && <span className="text-hv-gray">{family.phone}</span>}
          {family.inCrisis && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-hv-crisis text-white">
              {t('families.col_crisis')}
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-hv-gray">{t('families.caretaker2')}</dt>
            <dd className="text-hv-charcoal">
              {family.caretaker2Name || <span className="text-hv-gray">{t('form.none')}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-hv-gray">{t('families.income_sources')}</dt>
            <dd className="whitespace-pre-wrap text-hv-charcoal">
              {family.incomeSources || <span className="text-hv-gray">{t('form.none')}</span>}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-hv-gray">{t('families.deaths_notes')}</dt>
            <dd className="whitespace-pre-wrap text-hv-charcoal">
              {family.deathsNotes || <span className="text-hv-gray">{t('form.none')}</span>}
            </dd>
          </div>
        </dl>

        {family.notes && (
          <div className="mt-4 border-t border-hv-border pt-3">
            <p className="text-sm font-medium text-hv-gray">{t('form.notes')}</p>
            <p className="whitespace-pre-wrap text-hv-charcoal">{family.notes}</p>
          </div>
        )}
      </div>

      <section className={`${CARD} mb-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-hv-green">
            {t('families.members')}
            {memberCount > 0 && (
              <span className="ml-2 text-sm font-normal text-hv-gray tabular-nums">
                {memberCount}
              </span>
            )}
          </h2>
          <Link to={`/children/new?familyId=${familyId}`} className={ACTION}>
            {t('family.add_child')}
          </Link>
        </div>

        {mothersQuery.isLoading || childrenQuery.isLoading ? (
          <LoadingState message={t('common.loading')} />
        ) : memberCount === 0 ? (
          <EmptyState message={t('families.no_members')} />
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-hv-gray uppercase tracking-wider">
                {t('nav.mothers')}
              </h3>
              {mothers.length === 0 ? (
                <p className="mt-2 text-sm text-hv-gray">{t('form.none')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {mothers.map((mother) => (
                    <MemberLink
                      key={mother.id}
                      to={`/mothers/${mother.id}`}
                      name={mother.name || t('common.unnamed')}
                      meta={formatSubjectAge(mother.birthDate)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-hv-gray uppercase tracking-wider">
                {t('family.children')}
              </h3>
              {children.length === 0 ? (
                <p className="mt-2 text-sm text-hv-gray">{t('form.none')}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {children.map((child) => (
                    <MemberLink
                      key={child.id}
                      to={`/children/${child.id}`}
                      name={child.name || t('common.unnamed')}
                      meta={formatSubjectAge(child.birthDate)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-col gap-3 border-t border-hv-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-hv-green">{t('profile.enrollments')}</h2>
          {enrollPrograms.length === 0 ? (
            <p className="text-sm text-hv-gray">{t('profile.no_programs')}</p>
          ) : (
            <select
              className={SELECT}
              aria-label={t('profile.enroll')}
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  navigate(`/programs/${event.target.value}/enroll?familyId=${familyId}`);
                }
              }}
            >
              <option value="">{t('profile.enroll')}</option>
              {enrollPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {enrollmentsQuery.isLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : enrollments.length === 0 ? (
            <EmptyState message={t('profile.no_enrollments')} />
          ) : (
            enrollments.map((enrollment) => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={t('families.delete_title')}
        message={t('families.delete_message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default FamilyDetailPage;
