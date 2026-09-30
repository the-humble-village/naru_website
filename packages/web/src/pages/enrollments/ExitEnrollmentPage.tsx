import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import {
  EnrollmentExit,
  EnrollmentExitSchema,
  ExitReason,
  KIND_ENROLLMENT_DETAIL,
  NutritionalStatus,
  TranslationKey,
  computeNutritionZScores,
} from '@naru/shared';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { visitsApi } from '../../api/visits';
import {
  ConfirmDialog,
  ExitReasonBadge,
  PageHeader,
  PhotoUpload,
  WeightDelta,
} from '../../components';
import { useTranslation } from '../../hooks';
import { parseZodErrors } from '../../hooks/useFieldErrors';
import { AgeReadout, ageDaysAt, fetchSubjectSummary, todayLocal } from './EnrollPage';

const FIELD =
  'w-full min-h-[44px] px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const FIELD_ERROR = 'w-full min-h-[44px] px-3 py-2 border border-red-500 bg-red-50 rounded-md';
const LABEL = 'block text-sm font-medium text-hv-charcoal mb-1';
const SECTION = 'text-lg font-semibold text-hv-green';
const CARD = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4';

const EXIT_REASONS: ExitReason[] = [
  'GRADUATED',
  'WITHDREW',
  'MOVED_AWAY',
  'TRANSFERRED',
  'AGED_OUT',
  'LOST',
  'DIED',
];

const REASON_LABEL: Record<ExitReason, TranslationKey> = {
  GRADUATED: 'exit_reason.graduated',
  WITHDREW: 'exit_reason.withdrew',
  MOVED_AWAY: 'exit_reason.moved_away',
  DIED: 'exit_reason.died',
  TRANSFERRED: 'exit_reason.transferred',
  AGED_OUT: 'exit_reason.aged_out',
  LOST: 'exit_reason.lost',
};

const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};

const numberOrNull = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const textOrNull = (raw: string): string | null => (raw.trim() === '' ? null : raw.trim());

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

const preflight = <T,>(schema: z.ZodType<T>, data: unknown): string | null => {
  const result = schema.safeParse(data);
  if (result.success) return null;

  const first = Object.entries(parseZodErrors(result.error))[0];
  if (!first) return null;

  const [field, message] = first;
  return `${field}: ${message}`;
};

export const ExitEnrollmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const enrollmentId = id ? parseInt(id, 10) : 0;

  const {
    data: enrollment,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: () => enrollmentsApi.fetchEnrollment(enrollmentId),
    enabled: enrollmentId > 0,
  });

  const { data: program } = useQuery({
    queryKey: ['program', enrollment?.programId],
    queryFn: () => programsApi.fetchProgram(enrollment!.programId),
    enabled: Boolean(enrollment),
  });

  const subjectType = program?.subjectType ?? null;
  const subjectId = useMemo(() => {
    if (!enrollment || !subjectType) return null;
    switch (subjectType) {
      case 'MOTHER':
        return enrollment.motherId;
      case 'CHILD':
        return enrollment.childId;
      case 'PERSON':
        return enrollment.personId;
      case 'FAMILY':
        return enrollment.familyId;
      default:
        return null;
    }
  }, [enrollment, subjectType]);

  const { data: subject } = useQuery({
    queryKey: ['enroll-subject', subjectType, subjectId],
    queryFn: () => fetchSubjectSummary(subjectType!, subjectId!),
    enabled: Boolean(subjectType) && subjectId !== null,
  });

  const { data: visitList } = useQuery({
    queryKey: ['visits', { enrollmentId, limit: 100 }],
    queryFn: () => visitsApi.listVisits({ enrollmentId, limit: 100 }),
    enabled: enrollmentId > 0,
  });

  const [exitedAt, setExitedAt] = useState(todayLocal());
  const [exitReason, setExitReason] = useState<ExitReason | ''>('');
  const [exitWeight, setExitWeight] = useState('');
  const [exitNotes, setExitNotes] = useState('');
  const [exitPhotoId, setExitPhotoId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDied, setConfirmDied] = useState(false);
  const [done, setDone] = useState(false);

  const exitMutation = useMutation({
    mutationFn: (payload: EnrollmentExit) => enrollmentsApi.exitEnrollment(enrollmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setConfirmDied(false);
      setDone(true);
    },
  });

  const exitWeightKg = numberOrNull(exitWeight);
  const detailKind = program ? KIND_ENROLLMENT_DETAIL[program.kind] : null;
  const exitAgeDays = ageDaysAt(subject?.birthDate, exitedAt);

  // The graduation status the worker sees here comes from the same shared
  // function the visit form and the backend use, so the three cannot disagree.
  const liveExitStatus = useMemo(() => {
    if (detailKind !== 'nutrition' || !subject?.birthDate || !subject.sex) return null;
    if (exitAgeDays === null) return null;
    const scores = computeNutritionZScores(
      { weightKg: exitWeightKg, heightMm: null, armCircumferenceMm: null },
      exitAgeDays,
      subject.sex
    );
    return scores.nutritionalStatus;
  }, [detailKind, subject, exitAgeDays, exitWeightKg]);

  if (enrollmentId <= 0 || error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('exit.load_error')}</p>
      </div>
    );
  }

  if (isLoading || !enrollment) {
    return <div className="text-lg text-hv-gray py-8 text-center">{t('common.loading')}</div>;
  }

  const visitCount = visitList?.total ?? visitList?.items.length ?? 0;
  const entryStatus = enrollment.nutritionDetail?.nutritionalStatus ?? null;

  if (done || enrollment.exitedAt !== null) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title={t('exit.title')}
          backTo={`/enrollments/${enrollment.id}`}
          backLabel={program?.name ?? t('enrollment_detail.title')}
        />
        <div className={CARD}>
          <h2 className={SECTION}>
            {done ? t('exit.success_title') : t('exit.already_exited')}
          </h2>
          <p className="text-sm text-hv-gray">{t('exit.success_undo_hint')}</p>
          <Link
            to={`/enrollments/${enrollment.id}`}
            className="min-h-[44px] inline-flex items-center bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
          >
            {t('exit.view_enrollment')}
          </Link>
        </div>
      </div>
    );
  }

  // §7.3 and §7.4 are DB CHECK constraints. Surfacing them as field errors is
  // what stops Postgres rejecting the row with an opaque message.
  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (exitedAt === '') {
      errors.exitedAt = t('exit.date_required');
    } else if (exitedAt < enrollment.enrolledAt) {
      errors.exitedAt = t('exit.date_before_admission');
    }

    if (exitReason === '') {
      errors.exitReason = t('exit.reason_required');
    }

    return errors;
  };

  const submit = (): void => {
    const payload: EnrollmentExit = {
      exitedAt,
      exitReason: exitReason as ExitReason,
      exitWeight: exitWeightKg,
      exitPhotoId,
      exitNotes: textOrNull(exitNotes),
    };

    const invalid = preflight(EnrollmentExitSchema, payload);
    if (invalid) {
      setFormError(invalid);
      return;
    }

    exitMutation.mutate(payload, {
      onError: (err) => {
        setConfirmDied(false);
        setFormError(getErrorMessage(err, t('exit.error_save')));
      },
    });
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (exitReason === 'DIED') {
      setConfirmDied(true);
      return;
    }

    submit();
  };

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${t('exit.title')}: ${subject?.name ?? ''}`}
        backTo={`/enrollments/${enrollment.id}`}
        backLabel={program?.name ?? t('enrollment_detail.title')}
      />

      <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-hv-gray">
        <span>
          {t('exit.enrolled')} <span className="tabular-nums">{enrollment.enrolledAt}</span>
        </span>
        <span aria-hidden="true">&middot;</span>
        <span className="tabular-nums">
          {visitCount} {t('enrollment.visits')}
        </span>
        {enrollment.entryWeight !== null && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular-nums">
              {t('exit.entry')} {enrollment.entryWeight.toFixed(2)} kg
            </span>
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <section className={CARD}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exitedAt" className={LABEL}>
                {t('exit.exit_date')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                id="exitedAt"
                type="date"
                required
                value={exitedAt}
                onChange={(event) => setExitedAt(event.target.value)}
                className={fieldErrors.exitedAt ? FIELD_ERROR : FIELD}
              />
              {fieldErrors.exitedAt && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.exitedAt}</p>
              )}
            </div>

            <div>
              <label htmlFor="exitReason" className={LABEL}>
                {t('exit.reason')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                id="exitReason"
                required
                value={exitReason}
                onChange={(event) => setExitReason(event.target.value as ExitReason | '')}
                className={fieldErrors.exitReason ? FIELD_ERROR : FIELD}
              >
                <option value="">{t('exit.select_reason')}</option>
                {EXIT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(REASON_LABEL[reason])}
                  </option>
                ))}
              </select>
              {fieldErrors.exitReason && (
                <p className="text-red-500 text-sm mt-1">{fieldErrors.exitReason}</p>
              )}
            </div>

            <div>
              <label htmlFor="exitWeight" className={LABEL}>
                {t('exit.exit_weight_kg')}
              </label>
              <input
                id="exitWeight"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={exitWeight}
                onChange={(event) => setExitWeight(event.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <div>
            <span className={LABEL}>{t('exit.exit_photo')}</span>
            <PhotoUpload
              photos={exitPhotoId === null ? [] : [exitPhotoId]}
              onChange={(ids) => setExitPhotoId(ids.length === 0 ? null : ids[ids.length - 1] ?? null)}
              maxPhotos={1}
            />
          </div>

          <div>
            <label htmlFor="exitNotes" className={LABEL}>
              {t('exit.exit_notes')}
            </label>
            <textarea
              id="exitNotes"
              rows={4}
              value={exitNotes}
              onChange={(event) => setExitNotes(event.target.value)}
              className={FIELD}
            />
          </div>
        </section>

        <section className={CARD} aria-live="polite" data-testid="exit-summary">
          <h2 className={SECTION}>{t('exit.summary')}</h2>

          <WeightDelta from={enrollment.entryWeight} to={exitWeightKg} />

          <AgeReadout label={t('exit.age_at_exit')} days={exitAgeDays} />

          {(entryStatus !== null || liveExitStatus !== null) && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-hv-gray">
              <span>{t('exit.status')}</span>
              {entryStatus !== null && (
                <span className="font-medium text-hv-charcoal">{t(STATUS_LABEL[entryStatus])}</span>
              )}
              <span aria-hidden="true">&rarr;</span>
              {liveExitStatus !== null ? (
                <span
                  data-testid="live-exit-status"
                  className="font-medium text-hv-charcoal"
                >
                  {t(STATUS_LABEL[liveExitStatus])}
                </span>
              ) : (
                <span>{t('exit.status_pending')}</span>
              )}
            </p>
          )}

          {exitReason !== '' && <ExitReasonBadge reason={exitReason} />}
        </section>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{formError}</p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link
            to={`/enrollments/${enrollment.id}`}
            className="min-h-[44px] flex items-center justify-center bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </Link>
          <button
            type="submit"
            disabled={exitMutation.isPending}
            className="min-h-[44px] bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exitMutation.isPending ? t('common.saving') : t('exit.submit')}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDied}
        title={t('exit.confirm_died_title')}
        message={t('exit.confirm_died_message')}
        confirmLabel={t('exit.confirm_died_button')}
        cancelLabel={t('common.cancel')}
        busy={exitMutation.isPending}
        onConfirm={submit}
        onCancel={() => setConfirmDied(false)}
      />
    </div>
  );
};

export default ExitEnrollmentPage;
