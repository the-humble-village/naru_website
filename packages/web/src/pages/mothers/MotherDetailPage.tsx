import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentListItem } from '@naru/shared';
import { fetchMother, deleteMother } from '../../api/mothers';
import { fetchPerson } from '../../api/people';
import { listChildren } from '../../api/children';
import { fetchFamily } from '../../api/families';
import { listEnrollments } from '../../api/enrollments';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import { fetchBirthingAssistants } from '../../api/birthing-assistants';
import {
  ConfirmDialog,
  EmptyState,
  EnrollmentCard,
  LoadingState,
  PageHeader,
  RoleGate,
  StatStrip,
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

export const MotherDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const motherId = id ? parseInt(id, 10) : 0;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const motherQuery = useQuery({
    queryKey: ['mother', motherId],
    queryFn: () => fetchMother(motherId),
    enabled: motherId > 0,
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', { motherId }],
    queryFn: () => listEnrollments({ motherId, limit: 100 }),
    enabled: motherId > 0,
  });

  const childrenQuery = useQuery({
    queryKey: ['children', { motherId }],
    queryFn: () => listChildren({ motherId }),
    enabled: motherId > 0,
  });

  const communitiesQuery = useQuery({ queryKey: ['communities'], queryFn: fetchCommunities });
  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites });
  const programsQuery = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => listPrograms({ activeOnly: true }),
  });

  const mother = motherQuery.data;
  const enrollments = useMemo(
    () => [...(enrollmentsQuery.data?.items ?? [])].sort(byActiveThenDate),
    [enrollmentsQuery.data]
  );

  const midwifeId = mother?.midwifeId ?? 0;
  const midwifeQuery = useQuery({
    queryKey: ['person', midwifeId],
    queryFn: () => fetchPerson(midwifeId),
    enabled: midwifeId > 0,
  });

  const familyId = mother?.familyId ?? 0;
  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => fetchFamily(familyId),
    enabled: familyId > 0,
  });

  const needsAssistants = enrollments.some((item) => item.program.kind === 'PREGNANCY');
  const assistantsQuery = useQuery({
    queryKey: ['birthing-assistants'],
    queryFn: fetchBirthingAssistants,
    enabled: needsAssistants,
  });

  const assistantName = (enrollment: EnrollmentListItem): string | null => {
    const assistantId = enrollment.pregnancyDetail?.birthingAssistantId;
    if (!assistantId) {
      return null;
    }
    return assistantsQuery.data?.find((item) => item.id === assistantId)?.name ?? null;
  };

  const remove = useMutation({
    mutationFn: () => deleteMother(motherId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mothers'] });
      queryClient.removeQueries({ queryKey: ['mother', motherId] });
      setConfirmOpen(false);
      navigate('/mothers');
    },
  });

  if (motherQuery.isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (motherQuery.isError || !mother) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('mothers.load_failed')}</p>
      </div>
    );
  }

  const community = communitiesQuery.data?.find((item) => item.id === mother.communityId) ?? null;
  const site = sitesQuery.data?.find((item) => item.id === community?.siteId) ?? null;
  const children = childrenQuery.data?.items ?? [];
  const enrollPrograms = (programsQuery.data?.items ?? []).filter(
    (program) => program.subjectType === 'MOTHER'
  );

  const age = formatSubjectAge(mother.birthDate);

  return (
    <div>
      <PageHeader
        title={mother.name || t('common.unnamed')}
        backTo="/mothers"
        backLabel={t('nav.mothers')}
        actions={
          <>
            <Link to={`/mothers/${motherId}/edit`} className={ACTION}>
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
          {age && <span className="tabular-nums">{age}</span>}
          <span className="text-hv-gray">
            {community?.title ?? t('form.none')}
            {site ? ` (${t('form.site')}: ${site.title})` : ''}
          </span>
          {mother.phone && <span className="text-hv-gray">{mother.phone}</span>}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-hv-gray">{t('mothers.midwife')}</dt>
            <dd className="text-hv-charcoal">
              {midwifeId > 0 ? (
                <Link
                  to={`/people/${midwifeId}`}
                  className="text-hv-accent hover:text-hv-green transition-colors"
                >
                  {midwifeQuery.data?.name ?? `#${midwifeId}`}
                </Link>
              ) : (
                <span className="text-hv-gray">{t('form.none')}</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-hv-gray">{t('form.family')}</dt>
            <dd className="text-hv-charcoal">
              {familyId > 0 ? (
                <Link
                  to={`/families/${familyId}`}
                  className="text-hv-accent hover:text-hv-green transition-colors"
                >
                  {familyQuery.data?.familyName ?? `#${familyId}`}
                </Link>
              ) : (
                <span className="text-hv-gray">{t('form.none')}</span>
              )}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-hv-gray">{t('family.children')}</dt>
            <dd>
              {children.length === 0 ? (
                <span className="text-hv-gray">{t('form.none')}</span>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link
                        to={`/children/${child.id}`}
                        className="text-hv-accent hover:text-hv-green transition-colors"
                      >
                        {child.name || t('common.unnamed')}
                      </Link>
                      {formatSubjectAge(child.birthDate) && (
                        <span className="ml-1 text-sm text-hv-gray tabular-nums">
                          {formatSubjectAge(child.birthDate)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>

        {mother.notes && (
          <div className="mt-4 border-t border-hv-border pt-3">
            <dt className="text-sm font-medium text-hv-gray">{t('form.notes')}</dt>
            <dd className="whitespace-pre-wrap text-hv-charcoal">{mother.notes}</dd>
          </div>
        )}
      </div>

      <StatStrip
        className="mb-6"
        stats={[
          { label: t('mothers.pregnancies'), value: mother.pregnancies ?? 0 },
          { label: t('mothers.children_count'), value: mother.childrenCount ?? 0 },
          { label: t('mothers.breastfed_count'), value: mother.breastfedCount ?? 0 },
          {
            label: t('mothers.malnutrition_deaths'),
            value: mother.malnutritionDeaths ?? 0,
            tone: (mother.malnutritionDeaths ?? 0) > 0 ? 'crisis' : 'default',
          },
        ]}
      />

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
                  navigate(`/programs/${event.target.value}/enroll?motherId=${motherId}`);
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
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                birthingAssistantName={assistantName(enrollment)}
              />
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={t('mothers.delete_title')}
        message={t('mothers.delete_message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default MotherDetailPage;
