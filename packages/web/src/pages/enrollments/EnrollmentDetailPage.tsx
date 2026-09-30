import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import {
  EnrollmentUpdate,
  EnrollmentUpdateSchema,
  KIND_ENROLLMENT_DETAIL,
  LocationType,
  NutritionalStatus,
  TranslationKey,
} from '@naru/shared';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { visitsApi } from '../../api/visits';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import {
  ExitReasonBadge,
  FormSelect,
  PageHeader,
  PhotoUpload,
  RoleGate,
  SubjectTypeBadge,
  WeightDelta,
} from '../../components';
import { useTranslation } from '../../hooks';
import { parseZodErrors } from '../../hooks/useFieldErrors';
import { AgeReadout, ageDaysAt, fetchSubjectSummary, subjectHref } from './EnrollPage';

const FIELD =
  'w-full min-h-[44px] px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const LABEL = 'block text-sm font-medium text-hv-charcoal mb-1';
const SECTION = 'text-lg font-semibold text-hv-green';
const CARD = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4';

const LOCATION_LABEL: Record<LocationType, TranslationKey> = {
  SITE: 'location_type.site',
  HOME: 'location_type.home',
  MOBILE_CLINIC: 'location_type.mobile_clinic',
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

const asString = (value: number | string | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

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

const Detail: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline gap-2">
    <dt className="text-sm font-medium text-hv-gray">{label}</dt>
    <dd className="text-sm text-hv-charcoal">
      {children === null || children === undefined || children === '' ? (
        <span className="text-hv-gray">&mdash;</span>
      ) : (
        children
      )}
    </dd>
  </div>
);

interface EditState {
  enrolledAt: string;
  entryWeight: string;
  admissionNotes: string;
  dueDate: string;
  pregnancyNumber: string;
  birthingAssistantId: string;
  lengthAtAdmission: string;
  caretakerName: string;
  caretakerPhone: string;
  school: string;
  classYear: string;
}

export const EnrollmentDetailPage: React.FC = () => {
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

  const detailKind = program ? KIND_ENROLLMENT_DETAIL[program.kind] : null;

  const { data: birthingAssistants = [] } = useQuery({
    queryKey: ['birthing-assistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
    enabled: detailKind === 'pregnancy',
  });

  const [edit, setEdit] = useState<EditState | null>(null);
  const [entryPhotoId, setEntryPhotoId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (payload: EnrollmentUpdate) =>
      enrollmentsApi.updateEnrollment(enrollmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setEdit(null);
      setFormError(null);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => enrollmentsApi.reopenEnrollment(enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
    },
  });

  if (enrollmentId <= 0 || error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('enrollment_detail.load_error')}</p>
      </div>
    );
  }

  if (isLoading || !enrollment) {
    return <div className="text-lg text-hv-gray py-8 text-center">{t('common.loading')}</div>;
  }

  const isActive = enrollment.exitedAt === null;
  const visits = visitList?.items ?? [];
  const admissionAgeDays = ageDaysAt(subject?.birthDate, enrollment.enrolledAt);
  const exitAgeDays = enrollment.exitedAt
    ? ageDaysAt(subject?.birthDate, enrollment.exitedAt)
    : null;

  const birthingAssistantName =
    birthingAssistants.find(
      (assistant) => assistant.id === enrollment.pregnancyDetail?.birthingAssistantId
    )?.name ?? null;

  const startEdit = (): void => {
    setFormError(null);
    setEntryPhotoId(enrollment.entryPhotoId);
    setEdit({
      enrolledAt: enrollment.enrolledAt,
      entryWeight: asString(enrollment.entryWeight),
      admissionNotes: enrollment.admissionNotes ?? '',
      dueDate: enrollment.pregnancyDetail?.dueDate ?? '',
      pregnancyNumber: asString(enrollment.pregnancyDetail?.pregnancyNumber),
      birthingAssistantId: asString(enrollment.pregnancyDetail?.birthingAssistantId),
      lengthAtAdmission: asString(enrollment.nutritionDetail?.lengthAtAdmission),
      caretakerName: enrollment.nutritionDetail?.caretakerName ?? '',
      caretakerPhone: enrollment.nutritionDetail?.caretakerPhone ?? '',
      school: enrollment.studentDetail?.school ?? '',
      classYear: enrollment.studentDetail?.classYear ?? '',
    });
  };

  const setField = <K extends keyof EditState>(key: K, value: EditState[K]): void => {
    setEdit((previous) => (previous === null ? previous : { ...previous, [key]: value }));
  };

  const handleSave = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!edit) return;
    setFormError(null);

    const payload: EnrollmentUpdate = {
      enrolledAt: edit.enrolledAt,
      entryWeight: numberOrNull(edit.entryWeight),
      entryPhotoId,
      admissionNotes: textOrNull(edit.admissionNotes),
    };

    if (detailKind === 'pregnancy') {
      payload.pregnancyDetail = {
        dueDate: edit.dueDate === '' ? null : edit.dueDate,
        pregnancyNumber: numberOrNull(edit.pregnancyNumber),
        birthingAssistantId: numberOrNull(edit.birthingAssistantId),
      };
    }

    if (detailKind === 'nutrition') {
      payload.nutritionDetail = {
        lengthAtAdmission: numberOrNull(edit.lengthAtAdmission),
        caretakerName: textOrNull(edit.caretakerName),
        caretakerPhone: textOrNull(edit.caretakerPhone),
        nutritionalStatus: enrollment.nutritionDetail?.nutritionalStatus ?? null,
      };
    }

    if (detailKind === 'student') {
      payload.studentDetail = {
        school: textOrNull(edit.school),
        classYear: textOrNull(edit.classYear),
      };
    }

    const invalid = preflight(EnrollmentUpdateSchema, payload);
    if (invalid) {
      setFormError(invalid);
      return;
    }

    updateMutation.mutate(payload, {
      onError: (err) => setFormError(getErrorMessage(err, t('enrollment_detail.save_error'))),
    });
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={program?.name ?? t('enrollment_detail.title')}
        backTo={program ? `/programs/${program.id}` : '/'}
        backLabel={program?.name ?? t('enrollment_detail.title')}
        actions={
          <>
            {isActive && (
              <>
                <Link
                  to={`/enrollments/${enrollment.id}/visits/new`}
                  className="min-h-[44px] flex items-center bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
                >
                  {t('enrollment.add_visit')}
                </Link>
                <Link
                  to={`/enrollments/${enrollment.id}/exit`}
                  className="min-h-[44px] flex items-center bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
                >
                  {t('enrollment.exit')}
                </Link>
              </>
            )}
            {!isActive && (
              <RoleGate requiredRole="SUPERVISOR">
                <button
                  type="button"
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                  className="min-h-[44px] bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reopenMutation.isPending ? t('common.saving') : t('enrollment.reopen')}
                </button>
              </RoleGate>
            )}
            {edit === null && (
              <button
                type="button"
                onClick={startEdit}
                className="min-h-[44px] text-hv-accent hover:text-hv-green transition-colors"
              >
                {t('common.edit')}
              </button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <section className={CARD}>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-hv-green text-white' : 'bg-hv-page text-hv-gray'
              }`}
            >
              {isActive ? t('enrollment.active') : t('enrollment.exited')}
            </span>
            {!isActive && enrollment.exitReason && (
              <ExitReasonBadge reason={enrollment.exitReason} />
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <Detail label={t('enroll.program')}>
              {program ? (
                <Link
                  to={`/programs/${program.id}`}
                  className="text-hv-green hover:text-hv-green-hover transition-colors"
                >
                  {program.name}
                </Link>
              ) : null}
            </Detail>

            <Detail label={t('enroll.subject')}>
              {subjectType && subjectId !== null ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Link
                    to={subjectHref(subjectType, subjectId)}
                    className="text-hv-green hover:text-hv-green-hover transition-colors"
                  >
                    {subject?.name || t('common.unnamed')}
                  </Link>
                  <SubjectTypeBadge type={subjectType} />
                </span>
              ) : null}
            </Detail>
          </dl>

          <p className="text-xs text-hv-sage">{t('enrollment_detail.immutable_hint')}</p>
        </section>

        {edit === null ? (
          <section className={CARD}>
            <h2 className={SECTION}>{t('enroll.admission')}</h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Detail label={t('enroll.admission_date')}>
                <span className="tabular-nums">{enrollment.enrolledAt}</span>
              </Detail>
              <Detail label={t('enroll.entry_weight_kg')}>
                {enrollment.entryWeight === null ? null : (
                  <span className="tabular-nums">{enrollment.entryWeight.toFixed(2)}</span>
                )}
              </Detail>

              {detailKind === 'pregnancy' && (
                <>
                  <Detail label={t('enrollment.due_date')}>
                    {enrollment.pregnancyDetail?.dueDate}
                  </Detail>
                  <Detail label={t('enrollment.pregnancy_number')}>
                    {enrollment.pregnancyDetail?.pregnancyNumber
                      ? `#${enrollment.pregnancyDetail.pregnancyNumber}`
                      : null}
                  </Detail>
                  <Detail label={t('enrollment.birthing_assistant')}>
                    {birthingAssistantName}
                  </Detail>
                </>
              )}

              {detailKind === 'nutrition' && (
                <>
                  <Detail label={t('enroll.length_mm')}>
                    {enrollment.nutritionDetail?.lengthAtAdmission}
                  </Detail>
                  <Detail label={t('enrollment.caretaker')}>
                    {enrollment.nutritionDetail?.caretakerName}
                  </Detail>
                  <Detail label={t('enrollment.caretaker_phone')}>
                    {enrollment.nutritionDetail?.caretakerPhone}
                  </Detail>
                  <Detail label={t('enroll.nutritional_status')}>
                    {enrollment.nutritionDetail?.nutritionalStatus
                      ? t(STATUS_LABEL[enrollment.nutritionDetail.nutritionalStatus])
                      : null}
                  </Detail>
                </>
              )}

              {detailKind === 'student' && (
                <>
                  <Detail label={t('enrollment.school')}>
                    {enrollment.studentDetail?.school}
                  </Detail>
                  <Detail label={t('enrollment.class_year')}>
                    {enrollment.studentDetail?.classYear}
                  </Detail>
                </>
              )}
            </dl>

            <AgeReadout label={t('enroll.age_at_admission')} days={admissionAgeDays} />

            {enrollment.admissionNotes && (
              <div>
                <p className="text-sm font-medium text-hv-gray">{t('enroll.admission_notes')}</p>
                <p className="text-sm text-hv-charcoal whitespace-pre-line">
                  {enrollment.admissionNotes}
                </p>
              </div>
            )}

            {enrollment.entryPhotoId !== null && (
              <div>
                <span className={LABEL}>{t('enroll.entry_photo')}</span>
                <PhotoUpload
                  photos={[enrollment.entryPhotoId]}
                  onChange={() => undefined}
                  maxPhotos={1}
                  disabled
                  canDelete={false}
                />
              </div>
            )}
          </section>
        ) : (
          <form onSubmit={handleSave} className={CARD} noValidate>
            <h2 className={SECTION}>{t('enroll.admission')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="enrolledAt" className={LABEL}>
                  {t('enroll.admission_date')}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  id="enrolledAt"
                  type="date"
                  required
                  value={edit.enrolledAt}
                  onChange={(event) => setField('enrolledAt', event.target.value)}
                  className={FIELD}
                />
              </div>

              <div>
                <label htmlFor="entryWeight" className={LABEL}>
                  {t('enroll.entry_weight_kg')}
                </label>
                <input
                  id="entryWeight"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={edit.entryWeight}
                  onChange={(event) => setField('entryWeight', event.target.value)}
                  className={FIELD}
                />
              </div>

              {detailKind === 'pregnancy' && (
                <>
                  <div>
                    <label htmlFor="dueDate" className={LABEL}>
                      {t('enrollment.due_date')}
                    </label>
                    <input
                      id="dueDate"
                      type="date"
                      value={edit.dueDate}
                      onChange={(event) => setField('dueDate', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label htmlFor="pregnancyNumber" className={LABEL}>
                      {t('enrollment.pregnancy_number')}
                    </label>
                    <input
                      id="pregnancyNumber"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      value={edit.pregnancyNumber}
                      onChange={(event) => setField('pregnancyNumber', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <FormSelect
                    label={t('enrollment.birthing_assistant')}
                    name="birthingAssistantId"
                    value={edit.birthingAssistantId}
                    onChange={(event) => setField('birthingAssistantId', event.target.value)}
                    options={[
                      { value: '', label: t('visit.none') },
                      ...birthingAssistants.map((assistant) => ({
                        value: String(assistant.id),
                        label: assistant.name,
                      })),
                    ]}
                  />
                </>
              )}

              {detailKind === 'nutrition' && (
                <>
                  <div>
                    <label htmlFor="lengthAtAdmission" className={LABEL}>
                      {t('enroll.length_mm')}
                    </label>
                    <input
                      id="lengthAtAdmission"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      value={edit.lengthAtAdmission}
                      onChange={(event) => setField('lengthAtAdmission', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label htmlFor="caretakerName" className={LABEL}>
                      {t('enrollment.caretaker')}
                    </label>
                    <input
                      id="caretakerName"
                      type="text"
                      value={edit.caretakerName}
                      onChange={(event) => setField('caretakerName', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label htmlFor="caretakerPhone" className={LABEL}>
                      {t('enrollment.caretaker_phone')}
                    </label>
                    <input
                      id="caretakerPhone"
                      type="tel"
                      value={edit.caretakerPhone}
                      onChange={(event) => setField('caretakerPhone', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                </>
              )}

              {detailKind === 'student' && (
                <>
                  <div>
                    <label htmlFor="school" className={LABEL}>
                      {t('enrollment.school')}
                    </label>
                    <input
                      id="school"
                      type="text"
                      value={edit.school}
                      onChange={(event) => setField('school', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                  <div>
                    <label htmlFor="classYear" className={LABEL}>
                      {t('enrollment.class_year')}
                    </label>
                    <input
                      id="classYear"
                      type="text"
                      value={edit.classYear}
                      onChange={(event) => setField('classYear', event.target.value)}
                      className={FIELD}
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label htmlFor="admissionNotes" className={LABEL}>
                {t('enroll.admission_notes')}
              </label>
              <textarea
                id="admissionNotes"
                rows={4}
                value={edit.admissionNotes}
                onChange={(event) => setField('admissionNotes', event.target.value)}
                className={FIELD}
              />
            </div>

            <div>
              <span className={LABEL}>{t('enroll.entry_photo')}</span>
              <PhotoUpload
                photos={entryPhotoId === null ? [] : [entryPhotoId]}
                onChange={(ids) => setEntryPhotoId(ids.length === 0 ? null : ids[ids.length - 1] ?? null)}
                maxPhotos={1}
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-600">{formError}</p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEdit(null);
                  setFormError(null);
                }}
                className="min-h-[44px] bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="min-h-[44px] bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        {!isActive && (
          <section className={CARD}>
            <h2 className={SECTION}>{t('exit.title')}</h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Detail label={t('exit.exit_date')}>
                <span className="tabular-nums">{enrollment.exitedAt}</span>
              </Detail>
              <Detail label={t('exit.reason')}>
                {enrollment.exitReason ? <ExitReasonBadge reason={enrollment.exitReason} /> : null}
              </Detail>
              <Detail label={t('enrollment.weight')}>
                <WeightDelta from={enrollment.entryWeight} to={enrollment.exitWeight} />
              </Detail>
            </dl>

            <AgeReadout label={t('exit.age_at_exit')} days={exitAgeDays} />

            {enrollment.exitNotes && (
              <div>
                <p className="text-sm font-medium text-hv-gray">{t('exit.exit_notes')}</p>
                <p className="text-sm text-hv-charcoal whitespace-pre-line">
                  {enrollment.exitNotes}
                </p>
              </div>
            )}

            {enrollment.exitPhotoId !== null && (
              <div>
                <span className={LABEL}>{t('exit.exit_photo')}</span>
                <PhotoUpload
                  photos={[enrollment.exitPhotoId]}
                  onChange={() => undefined}
                  maxPhotos={1}
                  disabled
                  canDelete={false}
                />
              </div>
            )}
          </section>
        )}

        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={SECTION}>
              {visits.length} {t('enrollment.visits')}
            </h2>
            {isActive && (
              <Link
                to={`/enrollments/${enrollment.id}/visits/new`}
                className="min-h-[44px] flex items-center bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
              >
                {t('enrollment.add_visit')}
              </Link>
            )}
          </div>

          {visits.length === 0 ? (
            <p className="text-sm text-hv-gray">{t('enrollment.no_visits')}</p>
          ) : (
            <ul className="divide-y divide-hv-border">
              {visits.map((visit) => {
                const weight = visit.nutritionDetail?.weight ?? visit.pregnancyDetail?.weight ?? null;
                return (
                  <li key={visit.id}>
                    <Link
                      to={`/visits/${visit.id}`}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-2 py-3 text-sm text-hv-charcoal hover:bg-hv-page transition-colors"
                    >
                      <span className="tabular-nums font-medium">{visit.visitDate}</span>
                      <span className="text-hv-gray">{t(LOCATION_LABEL[visit.locationType])}</span>
                      {weight !== null && <span className="tabular-nums">{weight.toFixed(1)} kg</span>}
                      {visit.nutritionDetail?.nutritionalStatus && (
                        <span className="text-hv-gray">
                          {t(STATUS_LABEL[visit.nutritionDetail.nutritionalStatus])}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default EnrollmentDetailPage;
