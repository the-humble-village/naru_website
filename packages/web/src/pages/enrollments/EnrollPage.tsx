import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import {
  EnrollmentCreate,
  EnrollmentCreateSchema,
  KIND_ENROLLMENT_DETAIL,
  NutritionalStatus,
  SUBJECT_FK,
  Sex,
  SubjectType,
  TranslationKey,
  ageInDays,
  computeNutritionZScores,
} from '@naru/shared';
import { programsApi } from '../../api/programs';
import { enrollmentsApi } from '../../api/enrollments';
import { mothersApi } from '../../api/mothers';
import { childrenApi } from '../../api/children';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { adminApi } from '../../api/admin';
import {
  FormSelect,
  PageHeader,
  PhotoUpload,
  SubjectPicker,
  SubjectTypeBadge,
  ZScoreBadge,
} from '../../components';
import type { PickedSubject } from '../../components';
import { useTranslation } from '../../hooks';
import { parseZodErrors } from '../../hooks/useFieldErrors';

const FIELD =
  'w-full min-h-[44px] px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const LABEL = 'block text-sm font-medium text-hv-charcoal mb-1';
const SECTION = 'text-lg font-semibold text-hv-green';
const CARD = 'bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4';

const STATUS_TONE: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-600 text-white',
  MODERATE: 'bg-red-400 text-white',
  MILD: 'bg-yellow-500 text-white',
  NORMAL: 'bg-green-500 text-white',
};

const STATUS_LABEL: Record<NutritionalStatus, TranslationKey> = {
  SEVERE: 'nutritional_status.severe',
  MODERATE: 'nutritional_status.moderate',
  MILD: 'nutritional_status.mild',
  NORMAL: 'nutritional_status.normal',
};

export interface SubjectSummary {
  id: number;
  type: SubjectType;
  name: string;
  birthDate: string | null;
  sex: Sex | null;
  communityId: number | null;
}

export const fetchSubjectSummary = async (
  type: SubjectType,
  id: number
): Promise<SubjectSummary> => {
  switch (type) {
    case 'MOTHER': {
      const mother = await mothersApi.fetchMother(id);
      return {
        id: mother.id,
        type,
        name: mother.name,
        birthDate: mother.birthDate,
        sex: 'FEMALE',
        communityId: mother.communityId,
      };
    }
    case 'CHILD': {
      const child = await childrenApi.fetchChild(id);
      return {
        id: child.id,
        type,
        name: child.name,
        birthDate: child.birthDate,
        sex: child.sex,
        communityId: child.communityId,
      };
    }
    case 'PERSON': {
      const person = await peopleApi.fetchPerson(id);
      return {
        id: person.id,
        type,
        name: person.name,
        birthDate: person.birthDate,
        sex: person.sex,
        communityId: person.communityId,
      };
    }
    case 'FAMILY': {
      const family = await familiesApi.fetchFamily(id);
      return {
        id: family.id,
        type,
        name: family.familyName ?? '',
        birthDate: null,
        sex: null,
        communityId: family.communityId,
      };
    }
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

export const subjectHref = (type: SubjectType, id: number): string => {
  switch (type) {
    case 'MOTHER':
      return `/mothers/${id}`;
    case 'CHILD':
      return `/children/${id}`;
    case 'PERSON':
      return `/people/${id}`;
    case 'FAMILY':
      return `/families/${id}`;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

export const todayLocal = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const ageDaysAt = (
  birthDate: string | null | undefined,
  onDate: string
): number | null => {
  if (!birthDate || onDate === '') return null;
  const reference = new Date(onDate);
  if (Number.isNaN(reference.getTime())) return null;
  return ageInDays(new Date(birthDate), reference);
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

interface FormState {
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

const EMPTY_FORM: FormState = {
  enrolledAt: todayLocal(),
  entryWeight: '',
  admissionNotes: '',
  dueDate: '',
  pregnancyNumber: '',
  birthingAssistantId: '',
  lengthAtAdmission: '',
  caretakerName: '',
  caretakerPhone: '',
  school: '',
  classYear: '',
};

export const AgeReadout: React.FC<{ label: string; days: number | null }> = ({ label, days }) => {
  const { t } = useTranslation();

  if (days === null) {
    return null;
  }

  const years = Math.floor(days / 365.25);
  const value = years >= 2 ? years : Math.floor(days / 30.4375);
  const unit = years >= 2 ? t('enroll.years') : t('enroll.months');

  return (
    <p className="text-sm text-hv-gray">
      {label}{' '}
      <span className="font-medium text-hv-charcoal tabular-nums">
        {value} {unit}
      </span>
    </p>
  );
};

export const EnrollPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const programId = id ? parseInt(id, 10) : 0;

  const {
    data: program,
    isLoading: programLoading,
    error: programError,
  } = useQuery({
    queryKey: ['program', programId],
    queryFn: () => programsApi.fetchProgram(programId),
    enabled: programId > 0,
  });

  // The profile entry point routes here with the subject already chosen. A
  // param whose key does not match program.subjectType is ignored, so a stale
  // link can never enrol the wrong kind of subject.
  const prefilledId = useMemo(() => {
    if (!program) return null;
    const raw = searchParams.get(SUBJECT_FK[program.subjectType]);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [program, searchParams]);

  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const subjectId = picked === undefined ? prefilledId : picked;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [entryPhotoId, setEntryPhotoId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const subjectQuery = useQuery({
    queryKey: ['enroll-subject', program?.subjectType, subjectId],
    queryFn: () => fetchSubjectSummary(program!.subjectType, subjectId!),
    enabled: Boolean(program) && subjectId !== null,
  });

  const { data: communities = [] } = useQuery({
    queryKey: ['lookup', 'communities'],
    queryFn: adminApi.fetchCommunities,
  });

  const detailKind = program ? KIND_ENROLLMENT_DETAIL[program.kind] : null;

  const { data: birthingAssistants = [] } = useQuery({
    queryKey: ['birthing-assistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
    enabled: detailKind === 'pregnancy',
  });

  const communityNames = useMemo(() => {
    const map: Record<number, string> = {};
    communities.forEach((community) => {
      map[community.id] = community.title;
    });
    return map;
  }, [communities]);

  const subject = subjectQuery.data ?? null;
  const entryWeightKg = numberOrNull(form.entryWeight);
  const lengthMm = numberOrNull(form.lengthAtAdmission);
  const admissionAgeDays = ageDaysAt(subject?.birthDate, form.enrolledAt);

  // The backend persists what this returns, and the same function runs there on
  // save — the badge below and the stored status cannot disagree. Millimetres
  // go in raw; the conversion belongs to computeNutritionZScores.
  const live = useMemo(() => {
    if (detailKind !== 'nutrition' || !subject?.birthDate || !subject.sex) return null;
    if (admissionAgeDays === null) return null;
    return computeNutritionZScores(
      { weightKg: entryWeightKg, heightMm: lengthMm, armCircumferenceMm: null },
      admissionAgeDays,
      subject.sex
    );
  }, [detailKind, subject, admissionAgeDays, entryWeightKg, lengthMm]);

  const ageBandWarning = useMemo(() => {
    if (!program || admissionAgeDays === null) return false;
    const months = admissionAgeDays / 30.4375;
    if (program.minAgeMonths !== null && months < program.minAgeMonths) return true;
    if (program.maxAgeMonths !== null && months > program.maxAgeMonths) return true;
    return false;
  }, [program, admissionAgeDays]);

  const createMutation = useMutation({
    mutationFn: (payload: EnrollmentCreate) => enrollmentsApi.createEnrollment(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['subject-picker-enrolled'] });
      navigate(`/enrollments/${created.id}`);
    },
  });

  const handlePick = (next: PickedSubject): void => {
    setPicked(next.id);
    setFormError(null);
  };

  const buildPayload = (): EnrollmentCreate | null => {
    if (!program || subjectId === null) return null;

    const fk = SUBJECT_FK[program.subjectType];

    const payload: EnrollmentCreate = {
      programId: program.id,
      motherId: fk === 'motherId' ? subjectId : null,
      childId: fk === 'childId' ? subjectId : null,
      personId: fk === 'personId' ? subjectId : null,
      familyId: fk === 'familyId' ? subjectId : null,
      enrolledAt: form.enrolledAt,
      entryWeight: entryWeightKg,
      entryPhotoId,
      admissionNotes: textOrNull(form.admissionNotes),
    };

    if (detailKind === 'pregnancy') {
      payload.pregnancyDetail = {
        dueDate: form.dueDate === '' ? null : form.dueDate,
        pregnancyNumber: numberOrNull(form.pregnancyNumber),
        birthingAssistantId: numberOrNull(form.birthingAssistantId),
      };
    }

    if (detailKind === 'nutrition') {
      payload.nutritionDetail = {
        lengthAtAdmission: lengthMm,
        caretakerName: textOrNull(form.caretakerName),
        caretakerPhone: textOrNull(form.caretakerPhone),
        nutritionalStatus: live?.nutritionalStatus ?? null,
      };
    }

    if (detailKind === 'student') {
      payload.studentDetail = {
        school: textOrNull(form.school),
        classYear: textOrNull(form.classYear),
      };
    }

    return payload;
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setFormError(null);

    const payload = buildPayload();
    if (!payload) return;

    const invalid = preflight(EnrollmentCreateSchema, payload);
    if (invalid) {
      setFormError(invalid);
      return;
    }

    createMutation.mutate(payload, {
      onError: (err) => setFormError(getErrorMessage(err, t('enroll.error_save'))),
    });
  };

  if (programId <= 0 || programError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{t('enroll.load_error')}</p>
      </div>
    );
  }

  if (programLoading || !program) {
    return <div className="text-lg text-hv-gray py-8 text-center">{t('common.loading')}</div>;
  }

  const step = subjectId === null ? 1 : 2;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${t('enroll.title')}: ${program.name}`}
        backTo={`/programs/${program.id}`}
        backLabel={program.name}
      />

      <p className="mb-4 text-sm text-hv-gray">
        {step === 1 ? t('enroll.step_1_of_2') : t('enroll.step_2_of_2')}
        <span aria-hidden="true"> &middot; </span>
        {step === 1 ? t('enroll.choose_subject') : t('enroll.admission')}
      </p>

      {!program.active && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="text-amber-900">{t('enroll.program_inactive')}</p>
        </div>
      )}

      {step === 1 ? (
        <div className={CARD}>
          <h2 className={SECTION}>{t('enroll.choose_subject')}</h2>
          <SubjectPicker
            subjectType={program.subjectType}
            programId={program.id}
            programName={program.name}
            selectedId={subjectId}
            onSelect={handlePick}
            communityNames={communityNames}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <section className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-hv-gray">{t('enroll.subject')}</span>
                {subjectQuery.isLoading ? (
                  <span className="text-hv-gray">{t('common.loading')}</span>
                ) : (
                  <>
                    <Link
                      to={subjectHref(program.subjectType, subjectId as number)}
                      className="font-semibold text-hv-green hover:text-hv-green-hover transition-colors"
                    >
                      {subject?.name || t('common.unnamed')}
                    </Link>
                    <SubjectTypeBadge type={program.subjectType} />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="min-h-[44px] text-hv-accent hover:text-hv-green transition-colors"
              >
                {t('enroll.change_subject')}
              </button>
            </div>

            {ageBandWarning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-900">{t('enroll.age_band_warning')}</p>
              </div>
            )}
          </section>

          <section className={CARD}>
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
                  value={form.enrolledAt}
                  onChange={(event) => set('enrolledAt', event.target.value)}
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
                  value={form.entryWeight}
                  onChange={(event) => set('entryWeight', event.target.value)}
                  className={FIELD}
                />
              </div>
            </div>

            <AgeReadout label={t('enroll.age_at_admission')} days={admissionAgeDays} />

            <div>
              <span className={LABEL}>{t('enroll.entry_photo')}</span>
              <PhotoUpload
                photos={entryPhotoId === null ? [] : [entryPhotoId]}
                onChange={(ids) => setEntryPhotoId(ids.length === 0 ? null : ids[ids.length - 1] ?? null)}
                maxPhotos={1}
              />
            </div>
          </section>

          {detailKind === 'pregnancy' && (
            <section className={CARD}>
              <h2 className={SECTION}>{t('visit.pregnancy')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="dueDate" className={LABEL}>
                    {t('enrollment.due_date')}
                  </label>
                  <input
                    id="dueDate"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => set('dueDate', event.target.value)}
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
                    value={form.pregnancyNumber}
                    onChange={(event) => set('pregnancyNumber', event.target.value)}
                    className={FIELD}
                  />
                </div>

                <FormSelect
                  label={t('enrollment.birthing_assistant')}
                  name="birthingAssistantId"
                  value={form.birthingAssistantId}
                  onChange={(event) => set('birthingAssistantId', event.target.value)}
                  options={[
                    { value: '', label: t('visit.none') },
                    ...birthingAssistants.map((assistant) => ({
                      value: String(assistant.id),
                      label: assistant.name,
                    })),
                  ]}
                />
              </div>
            </section>
          )}

          {detailKind === 'nutrition' && (
            <section className={CARD}>
              <h2 className={SECTION}>{t('visit.nutrition')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    value={form.lengthAtAdmission}
                    onChange={(event) => set('lengthAtAdmission', event.target.value)}
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
                    value={form.caretakerName}
                    onChange={(event) => set('caretakerName', event.target.value)}
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
                    value={form.caretakerPhone}
                    onChange={(event) => set('caretakerPhone', event.target.value)}
                    className={FIELD}
                  />
                </div>
              </div>

              <div className="space-y-2" aria-live="polite">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-hv-gray">
                    {t('enroll.nutritional_status')}
                  </span>
                  {live?.nutritionalStatus ? (
                    <span
                      data-testid="live-nutritional-status"
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        STATUS_TONE[live.nutritionalStatus]
                      }`}
                    >
                      {t(STATUS_LABEL[live.nutritionalStatus])}
                    </span>
                  ) : (
                    <span className="text-sm text-hv-gray">
                      {subject?.birthDate && subject?.sex
                        ? t('enroll.status_pending')
                        : t('enroll.status_needs_birth_date')}
                    </span>
                  )}
                </div>

                {live && (
                  <div className="flex flex-wrap items-center gap-2">
                    {live.weightForAgeZ !== null && (
                      <ZScoreBadge zScore={live.weightForAgeZ} label={t('visit.z_wfa')} />
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {detailKind === 'student' && (
            <section className={CARD}>
              <h2 className={SECTION}>{t('enroll.student_section')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="school" className={LABEL}>
                    {t('enrollment.school')}
                  </label>
                  <input
                    id="school"
                    type="text"
                    value={form.school}
                    onChange={(event) => set('school', event.target.value)}
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
                    value={form.classYear}
                    onChange={(event) => set('classYear', event.target.value)}
                    className={FIELD}
                  />
                </div>
              </div>
            </section>
          )}

          <section className={CARD}>
            <div>
              <label htmlFor="admissionNotes" className={LABEL}>
                {t('enroll.admission_notes')}
              </label>
              <textarea
                id="admissionNotes"
                rows={4}
                value={form.admissionNotes}
                onChange={(event) => set('admissionNotes', event.target.value)}
                className={FIELD}
              />
            </div>
          </section>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-600">{formError}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Link
              to={`/programs/${program.id}`}
              className="min-h-[44px] flex items-center justify-center bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              {t('common.cancel')}
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending || !program.active}
              className="min-h-[44px] bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? t('common.saving') : t('enroll.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EnrollPage;
