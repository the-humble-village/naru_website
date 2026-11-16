import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentListItem } from '@naru/shared';
import { fetchPerson, deletePerson, fetchAssignedMothers } from '../../api/people';
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

export const PersonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const personId = id ? parseInt(id, 10) : 0;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const personQuery = useQuery({
    queryKey: ['person', personId],
    queryFn: () => fetchPerson(personId),
    enabled: personId > 0,
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', { personId }],
    queryFn: () => listEnrollments({ personId, limit: 100 }),
    enabled: personId > 0,
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

  const isMidwife = enrollments.some((item) => item.program.kind === 'MIDWIFE');
  const assignedQuery = useQuery({
    queryKey: ['person-mothers', personId],
    queryFn: () => fetchAssignedMothers(personId),
    enabled: personId > 0 && isMidwife,
  });

  const remove = useMutation({
    mutationFn: () => deletePerson(personId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.removeQueries({ queryKey: ['person', personId] });
      setConfirmOpen(false);
      navigate('/people');
    },
  });

  if (personQuery.isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  const person = personQuery.data;

  if (personQuery.isError || !person) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('people.load_failed')}</p>
      </div>
    );
  }

  const community = communitiesQuery.data?.find((item) => item.id === person.communityId) ?? null;
  const site = sitesQuery.data?.find((item) => item.id === community?.siteId) ?? null;
  const enrollPrograms = (programsQuery.data?.items ?? []).filter(
    (program) => program.subjectType === 'PERSON'
  );
  const assigned = assignedQuery.data?.items ?? [];
  const age = formatSubjectAge(person.birthDate);

  return (
    <div>
      <PageHeader
        title={person.name || t('common.unnamed')}
        backTo="/people"
        backLabel={t('nav.persons')}
        actions={
          <>
            <Link to={`/people/${personId}/edit`} className={ACTION}>
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
          {person.sex && (
            <span className="text-hv-gray">
              {person.sex === 'MALE' ? t('subject.sex_male') : t('subject.sex_female')}
            </span>
          )}
          <span className="text-hv-gray">
            {community?.title ?? t('form.none')}
            {site ? ` (${t('form.site')}: ${site.title})` : ''}
          </span>
          {person.phone && <span className="text-hv-gray">{person.phone}</span>}
        </div>

        {person.notes && (
          <div className="mt-4 border-t border-hv-border pt-3">
            <p className="text-sm font-medium text-hv-gray">{t('form.notes')}</p>
            <p className="whitespace-pre-wrap text-hv-charcoal">{person.notes}</p>
          </div>
        )}
      </div>

      {isMidwife && (
        <section className={`${CARD} mb-6`}>
          <h2 className="text-lg font-semibold text-hv-green">
            {t('people.assigned_mothers')}
            {assigned.length > 0 && (
              <span className="ml-2 text-sm font-normal text-hv-gray tabular-nums">
                {assigned.length}
              </span>
            )}
          </h2>
          {assignedQuery.isLoading ? (
            <LoadingState message={t('common.loading')} />
          ) : assigned.length === 0 ? (
            <EmptyState message={t('people.no_assigned_mothers')} />
          ) : (
            <ul className="mt-3 space-y-2">
              {assigned.map((mother) => (
                <li key={mother.id} className="border border-hv-border p-3 rounded">
                  <Link
                    to={`/mothers/${mother.id}`}
                    className="font-medium text-hv-green hover:text-hv-green-hover transition-colors"
                  >
                    {mother.name || t('common.unnamed')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                  navigate(`/programs/${event.target.value}/enroll?personId=${personId}`);
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
        title={t('people.delete_title')}
        message={t('people.delete_message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default PersonDetailPage;
