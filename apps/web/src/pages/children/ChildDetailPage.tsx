import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentListItem, VisitListItem } from '@naru/shared';
import { fetchChild, updateChild, deleteChild } from '../../api/children';
import { fetchMother, listMothers } from '../../api/mothers';
import { fetchFamily } from '../../api/families';
import { listEnrollments } from '../../api/enrollments';
import { listVisits } from '../../api/visits';
import { listPrograms } from '../../api/programs';
import { fetchCommunities, fetchSites } from '../../api/admin';
import {
  ConfirmDialog,
  EmptyState,
  EnrollmentCard,
  LoadingState,
  PageHeader,
  RoleGate,
  ZScoreBadge,
  formatSubjectAge,
} from '../../components';
import { useTranslation } from '../../hooks';

const CARD = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm';
const FIELD =
  'w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
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

interface TrendPoint {
  date: string;
  weight: number;
  zScore: number | null;
}

const SPARK_WIDTH = 220;
const SPARK_HEIGHT = 36;

const Sparkline: React.FC<{ points: TrendPoint[]; label: string }> = ({ points, label }) => {
  if (points.length < 2) {
    return null;
  }

  const weights = points.map((point) => point.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;
  const step = SPARK_WIDTH / (points.length - 1);

  const coords = points.map((point, index) => ({
    x: index * step,
    y: SPARK_HEIGHT - ((point.weight - min) / span) * (SPARK_HEIGHT - 6) - 3,
  }));

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      className="h-9 w-full max-w-[220px]"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="#2f4f39"
        strokeWidth={2}
        points={coords.map((coord) => `${coord.x},${coord.y}`).join(' ')}
      />
      {coords.map((coord, index) => (
        <circle key={points[index]?.date ?? index} cx={coord.x} cy={coord.y} r={2.5} fill="#637dff" />
      ))}
    </svg>
  );
};

const NutritionTrend: React.FC<{ enrollmentId: number }> = ({ enrollmentId }) => {
  const { t } = useTranslation();

  const visitsQuery = useQuery({
    queryKey: ['visits', { enrollmentId, limit: 100 }],
    queryFn: () => listVisits({ enrollmentId, limit: 100 }),
  });

  const points: TrendPoint[] = (visitsQuery.data?.items ?? [])
    .filter((visit: VisitListItem) => typeof visit.nutritionDetail?.weight === 'number')
    .map((visit: VisitListItem) => ({
      date: visit.visitDate,
      weight: visit.nutritionDetail?.weight as number,
      zScore: visit.nutritionDetail?.weightForAgeZ ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (visitsQuery.isLoading || points.length === 0) {
    return null;
  }

  const latest = points[points.length - 1];

  return (
    <div className="-mt-2 rounded-b-lg border border-t-0 border-hv-border bg-white px-4 py-3 sm:px-6">
      <p className="text-sm font-medium text-hv-gray">{t('profile.weight_trend')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Sparkline points={points} label={t('profile.weight_trend')} />
        {latest && latest.zScore !== null && (
          <ZScoreBadge zScore={latest.zScore} label={t('profile.weight_for_age')} />
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-hv-gray">
        {points.map((point) => (
          <li key={point.date} className="tabular-nums">
            <span className="text-hv-charcoal">{point.weight.toFixed(1)} kg</span> {point.date}
          </li>
        ))}
      </ul>
    </div>
  );
};

const MotherLinkPrompt: React.FC<{ childId: number }> = ({ childId }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(handle);
  }, [term]);

  const results = useQuery({
    queryKey: ['mothers', { search: debounced, limit: 10 }],
    queryFn: () => listMothers({ search: debounced, limit: 10 }),
    enabled: debounced.length > 0,
  });

  const link = useMutation({
    mutationFn: (motherId: number) => updateChild(childId, { motherId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['child', childId] });
      void queryClient.invalidateQueries({ queryKey: ['children'] });
    },
  });

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="font-medium text-amber-900">
        <span aria-hidden="true">&#9888; </span>
        {t('children.no_mother')}
      </p>
      <label htmlFor="link-mother" className="mt-3 block text-sm font-medium text-hv-gray">
        {t('children.link_mother')}
      </label>
      <input
        id="link-mother"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={t('children.search_mothers')}
        className={`${FIELD} mt-1`}
      />
      {results.isLoading && debounced.length > 0 && (
        <p className="mt-2 text-sm text-hv-gray">{t('common.loading')}</p>
      )}
      {(results.data?.items ?? []).length > 0 && (
        <ul className="mt-2 space-y-2">
          {(results.data?.items ?? []).map((mother) => (
            <li key={mother.id}>
              <button
                type="button"
                onClick={() => link.mutate(mother.id)}
                disabled={link.isPending}
                className="w-full rounded border border-hv-border bg-white p-2 text-left text-hv-charcoal hover:border-hv-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mother.name || t('common.unnamed')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ChildDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const childId = id ? parseInt(id, 10) : 0;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const childQuery = useQuery({
    queryKey: ['child', childId],
    queryFn: () => fetchChild(childId),
    enabled: childId > 0,
  });

  const enrollmentsQuery = useQuery({
    queryKey: ['enrollments', { childId }],
    queryFn: () => listEnrollments({ childId, limit: 100 }),
    enabled: childId > 0,
  });

  const communitiesQuery = useQuery({ queryKey: ['communities'], queryFn: fetchCommunities });
  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites });
  const programsQuery = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => listPrograms({ activeOnly: true }),
  });

  const child = childQuery.data;

  const motherId = child?.motherId ?? 0;
  const motherQuery = useQuery({
    queryKey: ['mother', motherId],
    queryFn: () => fetchMother(motherId),
    enabled: motherId > 0,
  });

  const familyId = child?.familyId ?? 0;
  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => fetchFamily(familyId),
    enabled: familyId > 0,
  });

  const enrollments = useMemo(
    () => [...(enrollmentsQuery.data?.items ?? [])].sort(byActiveThenDate),
    [enrollmentsQuery.data]
  );

  const remove = useMutation({
    mutationFn: () => deleteChild(childId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.removeQueries({ queryKey: ['child', childId] });
      setConfirmOpen(false);
      navigate('/children');
    },
  });

  if (childQuery.isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (childQuery.isError || !child) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('child_detail.load_error')}</p>
      </div>
    );
  }

  const community = communitiesQuery.data?.find((item) => item.id === child.communityId) ?? null;
  const site = sitesQuery.data?.find((item) => item.id === community?.siteId) ?? null;
  const enrollPrograms = (programsQuery.data?.items ?? []).filter(
    (program) => program.subjectType === 'CHILD'
  );
  const age = formatSubjectAge(child.birthDate);

  return (
    <div>
      <PageHeader
        title={child.name || t('common.unnamed')}
        backTo="/children"
        backLabel={t('nav.children')}
        actions={
          <>
            <Link to={`/children/${childId}/edit`} className={ACTION}>
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
            {child.sex === 'MALE' ? t('subject.sex_male') : t('subject.sex_female')}
          </span>
          <span className="text-hv-gray">
            {community?.title ?? t('form.none')}
            {site ? ` (${t('form.site')}: ${site.title})` : ''}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-hv-gray">{t('subject.col_mother')}</dt>
            <dd className="text-hv-charcoal">
              {motherId > 0 ? (
                <Link
                  to={`/mothers/${motherId}`}
                  className="text-hv-accent hover:text-hv-green transition-colors"
                >
                  {motherQuery.data?.name ?? `#${motherId}`}
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
        </dl>

        {child.notes && (
          <div className="mt-4 border-t border-hv-border pt-3">
            <p className="text-sm font-medium text-hv-gray">{t('form.notes')}</p>
            <p className="whitespace-pre-wrap text-hv-charcoal">{child.notes}</p>
          </div>
        )}
      </div>

      {motherId === 0 && (
        <div className="mb-6">
          <MotherLinkPrompt childId={childId} />
        </div>
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
                  navigate(`/programs/${event.target.value}/enroll?childId=${childId}`);
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
              <div key={enrollment.id}>
                <EnrollmentCard enrollment={enrollment} />
                {enrollment.program.kind === 'NUTRITION' && !enrollment.exitedAt && (
                  <NutritionTrend enrollmentId={enrollment.id} />
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={t('child_detail.delete_title')}
        message={t('child_detail.delete_message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default ChildDetailPage;
