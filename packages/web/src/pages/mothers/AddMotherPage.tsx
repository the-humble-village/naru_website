import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MotherCreateSchema, type MotherCreate, type MotherRead } from '@naru/shared';
import { mothersApi } from '../../api/mothers';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { programsApi } from '../../api/programs';
import { adminApi } from '../../api/admin';
import { FormField, FormSelect, NameInput, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';

export interface MotherFormValues {
  name: string;
  birthDate: string;
  communityId: string;
  phone: string;
  familyId: string;
  midwifeId: string;
  pregnancies: string;
  childrenCount: string;
  breastfedCount: string;
  malnutritionDeaths: string;
  notes: string;
}

export const EMPTY_MOTHER_FORM: MotherFormValues = {
  name: '',
  birthDate: '',
  communityId: '',
  phone: '',
  familyId: '',
  midwifeId: '',
  pregnancies: '',
  childrenCount: '',
  breastfedCount: '',
  malnutritionDeaths: '',
  notes: '',
};

export const motherToFormValues = (mother: MotherRead): MotherFormValues => ({
  name: mother.name,
  birthDate: mother.birthDate ? mother.birthDate.slice(0, 10) : '',
  communityId: mother.communityId ? String(mother.communityId) : '',
  phone: mother.phone ?? '',
  familyId: mother.familyId ? String(mother.familyId) : '',
  midwifeId: mother.midwifeId ? String(mother.midwifeId) : '',
  pregnancies: mother.pregnancies === null ? '' : String(mother.pregnancies),
  childrenCount: mother.childrenCount === null ? '' : String(mother.childrenCount),
  breastfedCount: mother.breastfedCount === null ? '' : String(mother.breastfedCount),
  malnutritionDeaths:
    mother.malnutritionDeaths === null ? '' : String(mother.malnutritionDeaths),
  notes: mother.notes ?? '',
});

const optionalCount = (value: string): number | null => (value === '' ? null : Number(value));

export const motherFormToPayload = (values: MotherFormValues): MotherCreate => ({
  name: values.name.trim(),
  birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : null,
  communityId: values.communityId ? Number(values.communityId) : null,
  phone: values.phone.trim() || null,
  familyId: values.familyId ? Number(values.familyId) : null,
  midwifeId: values.midwifeId ? Number(values.midwifeId) : null,
  pregnancies: optionalCount(values.pregnancies),
  childrenCount: optionalCount(values.childrenCount),
  breastfedCount: optionalCount(values.breastfedCount),
  malnutritionDeaths: optionalCount(values.malnutritionDeaths),
  notes: values.notes.trim() || null,
});

export const apiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

interface MotherFormProps {
  values: MotherFormValues;
  onChange: (values: MotherFormValues) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  submitLabel: string;
  busy: boolean;
  backTo: string;
}

export const MotherForm: React.FC<MotherFormProps> = ({
  values,
  onChange,
  onSubmit,
  errors,
  submitLabel,
  busy,
  backTo,
}) => {
  const { t } = useTranslation();

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: families } = useQuery({
    queryKey: ['families', { limit: 100 }],
    queryFn: () => familiesApi.listFamilies({ limit: 100 }),
  });
  const { data: programs } = useQuery({
    queryKey: ['programs', { activeOnly: true }],
    queryFn: () => programsApi.listPrograms({ activeOnly: true }),
  });

  const midwifeProgramIds = useMemo(
    () => (programs?.items ?? []).filter((p) => p.kind === 'MIDWIFE').map((p) => p.id),
    [programs]
  );

  // mother.midwifeId names a Person enrolled in a Midwives program - never a
  // birthing assistant, who is a separate medically-trained role recorded on the
  // pregnancy enrollment.
  const { data: midwives = [] } = useQuery({
    queryKey: ['people', 'midwives', midwifeProgramIds],
    enabled: midwifeProgramIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(
        midwifeProgramIds.map((programId) => peopleApi.listPeople({ programId, limit: 100 }))
      );
      const byId = new Map<number, { id: number; name: string }>();
      responses.forEach((response) =>
        response.items.forEach((person) => byId.set(person.id, { id: person.id, name: person.name }))
      );
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const selectedCommunity = values.communityId
    ? communities.find((community) => community.id === Number(values.communityId))
    : undefined;
  const derivedSite =
    selectedCommunity && selectedCommunity.siteId
      ? sites.find((site) => site.id === selectedCommunity.siteId)?.title ?? t('common.unknown')
      : '—';

  const set = (patch: Partial<MotherFormValues>) => onChange({ ...values, ...patch });

  const handleInput = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => set({ [event.target.name]: event.target.value } as Partial<MotherFormValues>);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="bg-white p-6 rounded-xl border border-hv-border space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-hv-charcoal mb-1">
            {t('form.name')}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <NameInput
            id="name"
            name="name"
            value={values.name}
            onChange={handleInput}
            maxLength={256}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta ${
              errors.name ? 'border-red-500' : 'border-hv-border-input'
            }`}
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        <FormField
          label={t('form.birth_date')}
          name="birthDate"
          type="date"
          value={values.birthDate}
          onChange={handleInput}
          error={errors.birthDate}
        />

        <div>
          <FormSelect
            label={t('form.community')}
            name="communityId"
            value={values.communityId}
            onChange={handleInput}
            error={errors.communityId}
            options={[
              { value: '', label: t('form.none') },
              ...communities.map((community) => ({
                value: String(community.id),
                label: community.title,
              })),
            ]}
          />
          <p className="text-sm text-hv-gray mt-1">
            {t('form.site')}: <span className="text-hv-charcoal">{derivedSite}</span>
          </p>
          <p className="text-xs text-hv-gray">{t('form.site_derived_hint')}</p>
        </div>

        <FormField
          label={t('form.phone')}
          name="phone"
          value={values.phone}
          onChange={handleInput}
          error={errors.phone}
          maxLength={64}
        />

        <FormSelect
          label={t('form.family')}
          name="familyId"
          value={values.familyId}
          onChange={handleInput}
          error={errors.familyId}
          options={[
            { value: '', label: t('form.none') },
            ...(families?.families ?? []).map((family) => ({
              value: String(family.id),
              label: family.familyName || t('common.unnamed'),
            })),
          ]}
        />

        <div>
          <FormSelect
            label={t('mothers.midwife')}
            name="midwifeId"
            value={values.midwifeId}
            onChange={handleInput}
            error={errors.midwifeId}
            options={[
              { value: '', label: t('form.none') },
              ...midwives.map((midwife) => ({
                value: String(midwife.id),
                label: midwife.name,
              })),
            ]}
          />
          <p className="text-xs text-hv-gray mt-1">{t('mothers.midwife_hint')}</p>
        </div>
      </div>

      <fieldset className="border-t border-hv-border pt-4">
        <legend className="text-sm font-semibold text-hv-charcoal">{t('mothers.counts')}</legend>
        <p className="text-xs text-hv-gray mb-3">{t('mothers.counts_hint')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField
            label={t('mothers.pregnancies')}
            name="pregnancies"
            type="number"
            value={values.pregnancies}
            onChange={handleInput}
            error={errors.pregnancies}
          />
          <FormField
            label={t('mothers.children_count')}
            name="childrenCount"
            type="number"
            value={values.childrenCount}
            onChange={handleInput}
            error={errors.childrenCount}
          />
          <FormField
            label={t('mothers.breastfed_count')}
            name="breastfedCount"
            type="number"
            value={values.breastfedCount}
            onChange={handleInput}
            error={errors.breastfedCount}
          />
          <FormField
            label={t('mothers.malnutrition_deaths')}
            name="malnutritionDeaths"
            type="number"
            value={values.malnutritionDeaths}
            onChange={handleInput}
            error={errors.malnutritionDeaths}
          />
        </div>
      </fieldset>

      <FormField
        label={t('form.notes')}
        name="notes"
        value={values.notes}
        onChange={handleInput}
        error={errors.notes}
        rows={4}
      />

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-hv-crisis">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-hv-border">
        <Link to={backTo} className="px-4 py-2 text-hv-sage hover:text-hv-charcoal transition-colors">
          {t('common.cancel')}
        </Link>
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? t('common.saving') : submitLabel}
        </button>
      </div>
    </form>
  );
};

export const AddMotherPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<MotherFormValues>(EMPTY_MOTHER_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMother = useMutation({
    mutationFn: (data: MotherCreate) => mothersApi.createMother(data),
    onSuccess: (mother) => {
      queryClient.invalidateQueries({ queryKey: ['mothers'] });
      // A brand-new mother has no enrollment, so she lands on the unenrolled
      // worklist and its sidebar badge immediately.
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      navigate(`/mothers/${mother.id}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('mothers.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const payload = motherFormToPayload(values);
    const result = MotherCreateSchema.safeParse(payload);
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    createMother.mutate(result.data);
  };

  return (
    <div>
      <PageHeader title={t('mothers.new_title')} backTo="/mothers" backLabel={t('nav.mothers')} />
      <MotherForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('mothers.add')}
        busy={createMother.isPending}
        backTo="/mothers"
      />
    </div>
  );
};

export default AddMotherPage;
