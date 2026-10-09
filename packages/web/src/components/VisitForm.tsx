import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import {
  KIND_VISIT_DETAIL,
  LocationType,
  NutritionVisitDetailRead,
  NutritionalStatus,
  ProgramKind,
  Sex,
  VisitAnswerEntry,
  VisitCreate,
  VisitCreateSchema,
  VisitRead,
  VisitResourceEntry,
  VisitUpdate,
  ageInDays,
  computeNutritionZScores,
} from '@naru/shared';
import { visitsApi } from '../api/visits';
import { photosApi } from '../api/photos';
import { adminApi } from '../api/admin';
import { useTranslation } from '../hooks/useTranslation';
import { parseZodErrors } from '../hooks/useFieldErrors';
import { FormSelect } from './ui/FormSelect';
import { ResourceRow, ResourceRowValue } from './ResourceRow';
import { TrainingPicker } from './TrainingPicker';
import { WeightDelta } from './WeightDelta';
import { ZScoreBadge } from './ZScoreBadge';
import { PhotoUpload } from './PhotoUpload';
import { VisitQuestionsPanel } from './VisitQuestionsPanel';

export interface VisitFormSubject {
  birthDate?: string | null;
  sex?: Sex | null;
}

export interface VisitFormProgram {
  id: number;
  kind: ProgramKind;
  name?: string;
}

export interface VisitFormProps {
  enrollmentId: number;
  program: VisitFormProgram;
  /** Child birth date + sex. Required for the live nutrition z-score, optional otherwise. */
  subject?: VisitFormSubject | null;
  /** Edit mode when present; the form reuses every field and PUTs instead of POSTing. */
  visit?: VisitRead | null;
  onSaved?: (visit: VisitRead) => void;
  onCancel?: () => void;
}

interface ResourceRowState {
  key: number;
  value: ResourceRowValue;
}

interface FormState {
  visitDate: string;
  locationType: LocationType;
  siteId: string;
  communityId: string;
  notes: string;
  weight: string;
  gestationMonths: string;
  examinationTypeId: string;
  height: string;
  armCircumference: string;
}

const FIELD =
  'w-full min-h-[44px] px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';
const LABEL = 'block text-sm font-medium text-hv-charcoal mb-1';
const SECTION = 'text-lg font-semibold text-hv-green';

const STATUS_COLOR: Record<NutritionalStatus, string> = {
  SEVERE: 'bg-red-600 text-white',
  MODERATE: 'bg-red-400 text-white',
  MILD: 'bg-yellow-500 text-white',
  NORMAL: 'bg-green-500 text-white',
};

const todayLocal = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const numberOrNull = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const asString = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
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

export const VisitForm: React.FC<VisitFormProps> = ({
  enrollmentId,
  program,
  subject,
  visit,
  onSaved,
  onCancel,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = Boolean(visit);
  const detailKind = KIND_VISIT_DETAIL[program.kind];

  const [form, setForm] = useState<FormState>(() => ({
    visitDate: visit?.visitDate ?? todayLocal(),
    locationType: visit?.locationType ?? 'SITE',
    siteId: asString(visit?.siteId ?? null),
    communityId: asString(visit?.communityId ?? null),
    notes: visit?.notes ?? '',
    weight: asString(visit?.pregnancyDetail?.weight ?? visit?.nutritionDetail?.weight ?? null),
    gestationMonths: asString(visit?.pregnancyDetail?.gestationMonths ?? null),
    examinationTypeId: asString(visit?.pregnancyDetail?.examinationTypeId ?? null),
    height: asString(visit?.nutritionDetail?.height ?? null),
    armCircumference: asString(visit?.nutritionDetail?.armCircumference ?? null),
  }));

  const rowKey = useRef(0);
  const [resources, setResources] = useState<ResourceRowState[]>(() =>
    (visit?.resources ?? []).map((entry) => ({
      key: rowKey.current++,
      value: {
        resourceId: entry.resourceId,
        quantity: entry.quantity,
        unit: entry.unit ?? null,
      },
    }))
  );
  const [trainingIds, setTrainingIds] = useState<number[]>(() => visit?.trainingIds ?? []);
  const [answers, setAnswers] = useState<VisitAnswerEntry[]>(() => visit?.answers ?? []);
  const [photoIds, setPhotoIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const { data: prefill } = useQuery({
    queryKey: ['visit-prefill', enrollmentId],
    queryFn: () => visitsApi.fetchVisitPrefill(enrollmentId),
    enabled: !isEdit,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['lookup', 'sites'],
    queryFn: adminApi.fetchSites,
  });
  const { data: communities = [] } = useQuery({
    queryKey: ['lookup', 'communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: resourceOptions = [] } = useQuery({
    queryKey: ['lookup', 'resources'],
    queryFn: adminApi.fetchResources,
  });
  const { data: trainingOptions = [] } = useQuery({
    queryKey: ['lookup', 'training'],
    queryFn: adminApi.fetchTraining,
  });
  const { data: examinationTypes = [] } = useQuery({
    queryKey: ['lookup', 'examination-types'],
    queryFn: adminApi.fetchExaminationTypes,
    enabled: detailKind === 'pregnancy',
  });

  const { data: history } = useQuery({
    queryKey: ['visits', { enrollmentId, limit: 5 }],
    queryFn: () => visitsApi.listVisits({ enrollmentId, limit: 5 }),
    enabled: detailKind !== null,
  });

  const { data: attachments } = useQuery({
    queryKey: ['photos', 'VISIT', visit?.id],
    queryFn: () => photosApi.listPhotos({ ownerType: 'VISIT', ownerId: visit!.id }),
    enabled: isEdit,
  });

  // Visits come back newest first, so the first row that is not the one being
  // edited is the previous visit the deltas are measured against.
  const previous = useMemo(
    () => (history?.items ?? []).find((item) => item.id !== visit?.id) ?? null,
    [history, visit]
  );

  const prefillApplied = useRef(false);
  useEffect(() => {
    if (isEdit || !prefill || prefillApplied.current) return;
    prefillApplied.current = true;
    setForm((previous_) => ({
      ...previous_,
      locationType: prefill.locationType,
      siteId: asString(prefill.siteId),
      communityId: asString(prefill.communityId),
    }));
  }, [prefill, isEdit]);

  const photosLoaded = useRef(false);
  useEffect(() => {
    if (!attachments || photosLoaded.current) return;
    photosLoaded.current = true;
    setPhotoIds(attachments.items.map((item) => item.fileId));
  }, [attachments]);

  const communityOptions = useMemo(
    () =>
      communities.filter(
        (community) =>
          form.siteId === '' ||
          asString(community.siteId ?? null) === form.siteId ||
          String(community.id) === form.communityId
      ),
    [communities, form.siteId, form.communityId]
  );

  const handleCommunity = (raw: string): void => {
    const picked = communities.find((community) => String(community.id) === raw);
    setForm((previous_) => ({
      ...previous_,
      communityId: raw,
      siteId:
        previous_.siteId === '' && picked?.siteId ? String(picked.siteId) : previous_.siteId,
    }));
  };

  const weightKg = numberOrNull(form.weight);
  const heightMm = numberOrNull(form.height);
  const armCircumferenceMm = numberOrNull(form.armCircumference);

  // The backend persists computeNutritionZScores()'s output; the badge below
  // renders the same call client-side, so the live reading and the stored one
  // cannot disagree. Millimetre conversion belongs to that function, not here.
  const live = useMemo(() => {
    if (detailKind !== 'nutrition' || !subject?.birthDate || !subject.sex) return null;
    const days = ageInDays(new Date(subject.birthDate), new Date(form.visitDate));
    if (days === null) return null;
    return computeNutritionZScores({ weightKg, heightMm, armCircumferenceMm }, days, subject.sex);
  }, [detailKind, subject, form.visitDate, weightKg, heightMm, armCircumferenceMm]);

  const buildPayload = (): { payload: VisitCreate; error: string | null } => {
    const cleanedResources: VisitResourceEntry[] = [];
    let resourceError: string | null = null;

    resources.forEach(({ value: row }) => {
      if (row.resourceId === null && row.quantity === null) return;
      if (row.resourceId === null || row.quantity === null) {
        resourceError = t('visit.error_resource_incomplete');
        return;
      }
      cleanedResources.push({
        resourceId: row.resourceId,
        quantity: row.quantity,
        unit: row.unit ?? null,
      });
    });

    const payload: VisitCreate = {
      enrollmentId,
      visitDate: form.visitDate,
      locationType: form.locationType,
      siteId: numberOrNull(form.siteId),
      communityId: numberOrNull(form.communityId),
      eventId: null,
      notes: form.notes.trim() === '' ? null : form.notes,
      resources: cleanedResources,
      trainingIds,
      answers,
    };

    if (detailKind === 'pregnancy') {
      payload.pregnancyDetail = {
        weight: weightKg,
        gestationMonths: numberOrNull(form.gestationMonths),
        examinationTypeId: numberOrNull(form.examinationTypeId),
      };
    }

    if (detailKind === 'nutrition') {
      payload.nutritionDetail = {
        weight: weightKg,
        height: heightMm,
        armCircumference: armCircumferenceMm,
      };
    }

    return { payload, error: resourceError };
  };

  const syncPhotos = async (visitId: number): Promise<void> => {
    const existing = attachments?.items ?? [];
    const existingFileIds = existing.map((item) => item.fileId);

    const added = photoIds.filter((fileId) => !existingFileIds.includes(fileId));
    const removed = existing.filter((item) => !photoIds.includes(item.fileId));

    for (const item of removed) {
      await photosApi.deletePhoto(item.id);
    }
    for (const [index, fileId] of added.entries()) {
      await photosApi.createPhoto({
        fileId,
        ownerType: 'VISIT',
        ownerId: visitId,
        caption: null,
        sortOrder: existingFileIds.length + index,
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: VisitCreate): Promise<VisitRead> => {
      if (isEdit && visit) {
        // The server replaces resources/trainings/answers only when the key is
        // present, and leaves them alone when absent — the form always shows all
        // three, so all three are always sent.
        const update: VisitUpdate = {
          visitDate: payload.visitDate,
          locationType: payload.locationType,
          siteId: payload.siteId,
          communityId: payload.communityId,
          eventId: payload.eventId,
          notes: payload.notes,
          resources: payload.resources,
          trainingIds: payload.trainingIds,
          answers: payload.answers,
          pregnancyDetail: payload.pregnancyDetail,
          nutritionDetail: payload.nutritionDetail,
        };
        return visitsApi.updateVisit(visit.id, update);
      }
      return visitsApi.createVisit(payload);
    },
    onSuccess: async (saved) => {
      try {
        await syncPhotos(saved.id);
      } catch (err) {
        setPhotoError(getErrorMessage(err, t('visit.error_photos')));
      }
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['photos', 'VISIT', saved.id] });
      onSaved?.(saved);
    },
  });

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setFormError(null);
    setPhotoError(null);

    const { payload, error } = buildPayload();
    if (error) {
      setFormError(error);
      return;
    }

    const invalid = preflight(VisitCreateSchema, payload);
    if (invalid) {
      setFormError(invalid);
      return;
    }

    saveMutation.mutate(payload, {
      onError: (err) => setFormError(getErrorMessage(err, t('visit.error_save'))),
    });
  };

  const prefillNote =
    !isEdit && prefill && prefill.source !== 'DEFAULT'
      ? prefill.source === 'PREVIOUS_VISIT'
        ? t('visit.prefill_previous')
        : t('visit.prefill_home')
      : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
        <h3 className={SECTION}>{isEdit ? t('visit.edit_visit') : t('visit.record_visit')}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="visitDate" className={LABEL}>
              {t('visit.date')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="visitDate"
              type="date"
              required
              value={form.visitDate}
              onChange={(event) => set('visitDate', event.target.value)}
              className={FIELD}
            />
          </div>

          <FormSelect
            label={t('visit.location_type')}
            name="locationType"
            required
            value={form.locationType}
            onChange={(event) => set('locationType', event.target.value as LocationType)}
            options={[
              { value: 'SITE', label: t('visit.location_site') },
              { value: 'HOME', label: t('visit.location_home') },
              { value: 'MOBILE_CLINIC', label: t('visit.location_mobile_clinic') },
            ]}
          />

          <FormSelect
            label={t('visit.site')}
            name="siteId"
            value={form.siteId}
            onChange={(event) => set('siteId', event.target.value)}
            options={[
              { value: '', label: t('visit.none') },
              ...sites.map((site) => ({ value: String(site.id), label: site.title })),
            ]}
          />

          <FormSelect
            label={t('visit.community')}
            name="communityId"
            value={form.communityId}
            onChange={(event) => handleCommunity(event.target.value)}
            options={[
              { value: '', label: t('visit.none') },
              ...communityOptions.map((community) => ({
                value: String(community.id),
                label: community.title,
              })),
            ]}
          />
        </div>

        {prefillNote && <p className="text-xs text-hv-sage">{prefillNote}</p>}
      </section>

      {detailKind === 'pregnancy' && (
        <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
          <h3 className={SECTION}>{t('visit.pregnancy')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="weight" className={LABEL}>
                {t('visit.weight_kg')}
              </label>
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={form.weight}
                onChange={(event) => set('weight', event.target.value)}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="gestationMonths" className={LABEL}>
                {t('visit.gestation_months')}
              </label>
              <input
                id="gestationMonths"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                max="11"
                value={form.gestationMonths}
                onChange={(event) => set('gestationMonths', event.target.value)}
                className={FIELD}
              />
            </div>

            <FormSelect
              label={t('visit.examination_type')}
              name="examinationTypeId"
              value={form.examinationTypeId}
              onChange={(event) => set('examinationTypeId', event.target.value)}
              options={[
                { value: '', label: t('visit.none') },
                ...examinationTypes.map((type) => ({
                  value: String(type.id),
                  label: type.title,
                })),
              ]}
            />
          </div>

          {previous?.pregnancyDetail?.weight !== undefined && (
            <p className="text-sm text-hv-gray">
              {t('visit.since_last_visit')}{' '}
              <WeightDelta from={previous?.pregnancyDetail?.weight ?? null} to={weightKg} />
            </p>
          )}
        </section>
      )}

      {detailKind === 'nutrition' && (
        <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
          <h3 className={SECTION}>{t('visit.nutrition')}</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="weight" className={LABEL}>
                {t('visit.weight_kg')}
              </label>
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={form.weight}
                onChange={(event) => set('weight', event.target.value)}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="height" className={LABEL}>
                {t('visit.height_mm')}
              </label>
              <input
                id="height"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.height}
                onChange={(event) => set('height', event.target.value)}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="armCircumference" className={LABEL}>
                {t('visit.arm_circumference_mm')}
              </label>
              <input
                id="armCircumference"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                value={form.armCircumference}
                onChange={(event) => set('armCircumference', event.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <NutritionReadout
            live={live}
            previous={previous?.nutritionDetail ?? null}
            weightKg={weightKg}
            hasSubject={Boolean(subject?.birthDate && subject?.sex)}
          />
        </section>
      )}

      <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
        <h3 className={SECTION}>{t('visit.trainings_given')}</h3>
        <TrainingPicker
          options={trainingOptions.map((option) => ({ id: option.id, title: option.title }))}
          selectedIds={trainingIds}
          onChange={setTrainingIds}
        />
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
        <h3 className={SECTION}>{t('visit.resources_given')}</h3>

        <div className="space-y-3">
          {resources.map((row) => (
            <ResourceRow
              key={row.key}
              options={resourceOptions.map((option) => ({
                id: option.id,
                title: option.title,
                defaultUnit: option.defaultUnit ?? null,
              }))}
              value={row.value}
              onChange={(next) =>
                setResources((current) =>
                  current.map((entry) => (entry.key === row.key ? { ...entry, value: next } : entry))
                )
              }
              onRemove={() =>
                setResources((current) => current.filter((entry) => entry.key !== row.key))
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setResources((current) => [
              ...current,
              { key: rowKey.current++, value: { resourceId: null, quantity: null, unit: null } },
            ])
          }
          className="min-h-[44px] text-hv-accent hover:text-hv-green transition-colors"
        >
          {t('visit.add_resource')}
        </button>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
        <h3 className={SECTION}>{t('visit.questions')}</h3>
        <VisitQuestionsPanel programId={program.id} value={answers} onChange={setAnswers} />
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-lg border border-hv-border shadow-sm space-y-4">
        <h3 className={SECTION}>{t('visit.notes_and_photos')}</h3>

        <div>
          <label htmlFor="notes" className={LABEL}>
            {t('visit.notes')}
          </label>
          <textarea
            id="notes"
            rows={4}
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            className={FIELD}
          />
        </div>

        <PhotoUpload photos={photoIds} onChange={setPhotoIds} />
        {photoError && <p className="text-red-500 text-sm">{photoError}</p>}
      </section>

      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{formError}</p>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] bg-hv-gray text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="min-h-[44px] bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? t('common.saving') : t('visit.save_visit')}
        </button>
      </div>
    </form>
  );
};

interface NutritionReadoutProps {
  live: ReturnType<typeof computeNutritionZScores> | null;
  previous: NutritionVisitDetailRead | null;
  weightKg: number | null;
  hasSubject: boolean;
}

const NutritionReadout: React.FC<NutritionReadoutProps> = ({
  live,
  previous,
  weightKg,
  hasSubject,
}) => {
  const { t } = useTranslation();

  const statusLabel = (status: NutritionalStatus): string => {
    switch (status) {
      case 'SEVERE':
        return t('nutrition.severe');
      case 'MODERATE':
        return t('nutrition.moderate');
      case 'MILD':
        return t('nutrition.mild');
      default:
        return t('nutrition.normal');
    }
  };

  if (!hasSubject) {
    return <p className="text-sm text-hv-gray">{t('visit.zscore_needs_birth_date')}</p>;
  }

  if (!live || (live.weightForAgeZ === null && live.muacZ === null)) {
    return <p className="text-sm text-hv-gray">{t('visit.zscore_pending')}</p>;
  }

  const basis =
    live.muacZ !== null && previous?.muacZ !== null && previous?.muacZ !== undefined
      ? { current: live.muacZ, was: previous.muacZ, label: t('visit.z_muac') }
      : live.weightForAgeZ !== null &&
          previous?.weightForAgeZ !== null &&
          previous?.weightForAgeZ !== undefined
        ? { current: live.weightForAgeZ, was: previous.weightForAgeZ, label: t('visit.z_wfa') }
        : null;

  const delta = basis ? basis.current - basis.was : null;

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        {live.nutritionalStatus && (
          <span
            data-testid="live-nutritional-status"
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLOR[live.nutritionalStatus]
            }`}
          >
            {statusLabel(live.nutritionalStatus)}
          </span>
        )}

        {previous?.nutritionalStatus && (
          <span className="text-sm text-hv-gray">
            {t('visit.was_status')} {statusLabel(previous.nutritionalStatus)}
            {delta !== null && basis && (
              <span className="ml-1 tabular-nums">
                ({delta > 0 ? '+' : ''}
                {delta.toFixed(1)} {basis.label})
              </span>
            )}
          </span>
        )}

        {delta !== null && delta !== 0 && (
          <span
            className={`text-sm font-medium ${delta > 0 ? 'text-hv-green' : 'text-hv-crisis'}`}
          >
            {delta > 0 ? `↑ ${t('visit.improving')}` : `↓ ${t('visit.worsening')}`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {live.weightForAgeZ !== null && (
          <ZScoreBadge zScore={live.weightForAgeZ} label={t('visit.z_wfa')} />
        )}
        {live.muacZ !== null && <ZScoreBadge zScore={live.muacZ} label={t('visit.z_muac')} />}
      </div>

      {(previous?.weight !== null && previous?.weight !== undefined) || weightKg !== null ? (
        <p className="text-sm text-hv-gray">
          {t('visit.since_last_visit')}{' '}
          <WeightDelta from={previous?.weight ?? null} to={weightKg} />
        </p>
      ) : null}
    </div>
  );
};

export default VisitForm;
