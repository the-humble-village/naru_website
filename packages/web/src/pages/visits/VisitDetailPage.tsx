import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  LocationType,
  NutritionalStatus,
  TranslationKey,
  VisitAnswerEntry,
} from '@naru/shared';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { photosApi } from '../../api/photos';
import { questionsApi } from '../../api/questions';
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  PageHeader,
  PhotoGallery,
  RoleGate,
  ZScoreBadge,
} from '../../components';
import { useTranslation } from '../../hooks';
import { formatDateUTC } from '../../utils/datetime';
import { useEnrollmentContext } from './RecordVisitPage';

const SECTION = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4';
const HEADING = 'text-lg font-semibold text-hv-green';

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

interface FactProps {
  label: string;
  children: React.ReactNode;
}

const Fact: React.FC<FactProps> = ({ label, children }) => (
  <div>
    <dt className="text-sm text-hv-gray">{label}</dt>
    <dd className="text-hv-charcoal">{children}</dd>
  </div>
);

export const VisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const visitId = id ? parseInt(id, 10) : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    data: visit,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => visitsApi.fetchVisit(visitId),
    enabled: visitId > 0,
  });

  const enrollmentId = visit?.enrollmentId ?? 0;
  const { program, subject } = useEnrollmentContext(enrollmentId);

  // VisitRead carries recordedById but not the name; the list endpoint is the
  // only place the join is exposed.
  const { data: siblings } = useQuery({
    queryKey: ['visits', { enrollmentId, limit: 100 }],
    queryFn: () => visitsApi.listVisits({ enrollmentId, limit: 100 }),
    enabled: enrollmentId > 0,
  });

  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: resources = [] } = useQuery({
    queryKey: ['lookup', 'resources'],
    queryFn: adminApi.fetchResources,
  });
  const { data: trainings = [] } = useQuery({
    queryKey: ['lookup', 'training'],
    queryFn: adminApi.fetchTraining,
  });
  const { data: examinationTypes = [] } = useQuery({
    queryKey: ['lookup', 'examination-types'],
    queryFn: adminApi.fetchExaminationTypes,
    enabled: program?.kind === 'PREGNANCY',
  });
  const { data: questions = [] } = useQuery({
    queryKey: ['questions'],
    queryFn: questionsApi.listQuestions,
  });
  const { data: photos } = useQuery({
    queryKey: ['photos', 'VISIT', visitId],
    queryFn: () => photosApi.listPhotos({ ownerType: 'VISIT', ownerId: visitId }),
    enabled: visitId > 0,
  });

  const titleOf = <T extends { id: number; title: string }>(
    list: T[],
    lookupId: number | null | undefined
  ): string => {
    if (lookupId === null || lookupId === undefined) return '—';
    return list.find((entry) => entry.id === lookupId)?.title ?? String(lookupId);
  };

  const questionTitle = useMemo(() => {
    const map = new Map<number, string>();
    questions.forEach((question) => map.set(question.id, question.title));
    return map;
  }, [questions]);

  const recordedByName =
    siblings?.items.find((item) => item.id === visitId)?.recordedByName ?? null;

  const deleteMutation = useMutation({
    mutationFn: () => visitsApi.deleteVisit(visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.removeQueries({ queryKey: ['visit', visitId] });
      setConfirmOpen(false);
      navigate(enrollmentId > 0 ? `/enrollments/${enrollmentId}` : '/visits');
    },
  });

  const describeAnswer = (answer: VisitAnswerEntry): string => {
    if (answer.valueText !== null && answer.valueText !== undefined) return answer.valueText;
    if (answer.valueNum !== null && answer.valueNum !== undefined) return String(answer.valueNum);
    if (answer.valueBool !== null && answer.valueBool !== undefined) {
      return answer.valueBool ? t('common.yes') : t('common.no');
    }
    return '—';
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (isError || !visit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('visit.detail_load_failed')}</p>
      </div>
    );
  }

  const nutrition = visit.nutritionDetail ?? null;
  const pregnancy = visit.pregnancyDetail ?? null;
  const photoIds = (photos?.items ?? []).map((item) => item.fileId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatDateUTC(visit.visitDate)}
        backTo={`/enrollments/${visit.enrollmentId}`}
        backLabel={
          subject && program ? `${subject.name} · ${program.name}` : t('visit.back_to_enrollment')
        }
        actions={
          <>
            <Link
              to={`/visits/${visit.id}/edit`}
              className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              {t('common.edit')}
            </Link>
            <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="bg-hv-crisis text-white px-4 py-2 rounded-md hover:bg-red-800 transition-colors"
              >
                {t('common.delete')}
              </button>
            </RoleGate>
          </>
        }
      />

      <section className={SECTION}>
        <h2 className={HEADING}>{t('visit.details')}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Fact label={t('visit.date')}>{formatDateUTC(visit.visitDate)}</Fact>
          <Fact label={t('visit.location_type')}>{t(LOCATION_KEY[visit.locationType])}</Fact>
          <Fact label={t('visit.site')}>{titleOf(sites, visit.siteId)}</Fact>
          <Fact label={t('visit.community')}>{titleOf(communities, visit.communityId)}</Fact>
          <Fact label={t('visit.col_subject')}>
            {subject ? (
              <Link to={subject.path} className="text-hv-terracotta hover:underline">
                {subject.name}
              </Link>
            ) : (
              '—'
            )}
          </Fact>
          <Fact label={t('visit.col_program')}>
            <Link
              to={`/enrollments/${visit.enrollmentId}`}
              className="text-hv-terracotta hover:underline"
            >
              {program?.name ?? '—'}
            </Link>
          </Fact>
          <Fact label={t('visit.recorded_by')}>{recordedByName ?? '—'}</Fact>
          <div className="sm:col-span-2">
            <dt className="text-sm text-hv-gray">{t('visit.notes')}</dt>
            <dd className="text-hv-charcoal whitespace-pre-wrap">{visit.notes || '—'}</dd>
          </div>
        </dl>
      </section>

      {pregnancy && (
        <section className={SECTION}>
          <h2 className={HEADING}>{t('visit.pregnancy')}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Fact label={t('visit.weight_kg')}>{pregnancy.weight ?? '—'}</Fact>
            <Fact label={t('visit.gestation_months')}>{pregnancy.gestationMonths ?? '—'}</Fact>
            <Fact label={t('visit.examination_type')}>
              {titleOf(examinationTypes, pregnancy.examinationTypeId)}
            </Fact>
          </dl>
        </section>
      )}

      {nutrition && (
        <section className={SECTION}>
          <h2 className={HEADING}>{t('visit.nutrition')}</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Fact label={t('visit.weight_kg')}>{nutrition.weight ?? '—'}</Fact>
            <Fact label={t('visit.height_mm')}>{nutrition.height ?? '—'}</Fact>
            <Fact label={t('visit.arm_circumference_mm')}>
              {nutrition.armCircumference ?? '—'}
            </Fact>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            {nutrition.nutritionalStatus && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  STATUS_COLOR[nutrition.nutritionalStatus]
                }`}
              >
                {t(STATUS_KEY[nutrition.nutritionalStatus])}
              </span>
            )}
            <ZScoreBadge zScore={nutrition.weightForAgeZ} label={t('visit.z_wfa')} />
            <ZScoreBadge zScore={nutrition.muacZ} label={t('visit.z_muac')} />
          </div>
        </section>
      )}

      <section className={SECTION}>
        <h2 className={HEADING}>{t('visit.resources_given')}</h2>
        {visit.resources.length === 0 ? (
          <EmptyState message={t('visit.no_resources_given')} />
        ) : (
          <ul className="space-y-2">
            {visit.resources.map((entry) => (
              <li key={entry.resourceId} className="text-sm text-hv-charcoal">
                {titleOf(resources, entry.resourceId)}
                {' — '}
                <span className="tabular-nums">{entry.quantity}</span>
                {entry.unit ? ` ${entry.unit}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>{t('visit.trainings_given')}</h2>
        {visit.trainingIds.length === 0 ? (
          <EmptyState message={t('visit.no_trainings_given')} />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {visit.trainingIds.map((trainingId) => (
              <li
                key={trainingId}
                className="px-3 py-1 bg-hv-sage text-white rounded-full text-sm"
              >
                {titleOf(trainings, trainingId)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>{t('visit.questions')}</h2>
        {visit.answers.length === 0 ? (
          <EmptyState message={t('visit.no_answers')} />
        ) : (
          <dl className="space-y-3">
            {visit.answers.map((answer) => (
              <div key={answer.questionId}>
                <dt className="text-sm text-hv-gray">
                  {questionTitle.get(answer.questionId) ?? `#${answer.questionId}`}
                </dt>
                <dd className="text-hv-charcoal">{describeAnswer(answer)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>{t('visit.photos')}</h2>
        {photoIds.length === 0 ? (
          <EmptyState message={t('visit.no_photos')} />
        ) : (
          <PhotoGallery photos={photoIds} canDelete={false} />
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={t('visit.delete_title')}
        message={t('visit.delete_message')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        busy={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default VisitDetailPage;
