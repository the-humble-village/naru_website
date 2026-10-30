import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FamilyCreateSchema, type FamilyCreate, type FamilyRead } from '@naru/shared';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import { FormField, FormSelect, LoadingState, NameInput, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';

export interface FamilyFormValues {
  familyName: string;
  communityId: string;
  phone: string;
  caretaker2Name: string;
  incomeSources: string;
  deathsNotes: string;
  inCrisis: boolean;
  notes: string;
}

export const EMPTY_FAMILY_FORM: FamilyFormValues = {
  familyName: '',
  communityId: '',
  phone: '',
  caretaker2Name: '',
  incomeSources: '',
  deathsNotes: '',
  inCrisis: false,
  notes: '',
};

export const familyToFormValues = (family: FamilyRead): FamilyFormValues => ({
  familyName: family.familyName ?? '',
  communityId: family.communityId ? String(family.communityId) : '',
  phone: family.phone ?? '',
  caretaker2Name: family.caretaker2Name ?? '',
  incomeSources: family.incomeSources ?? '',
  deathsNotes: family.deathsNotes ?? '',
  inCrisis: family.inCrisis,
  notes: family.notes ?? '',
});

export const familyFormToPayload = (values: FamilyFormValues): FamilyCreate => ({
  familyName: values.familyName.trim() || null,
  communityId: values.communityId ? Number(values.communityId) : null,
  phone: values.phone.trim() || null,
  caretaker2Name: values.caretaker2Name.trim() || null,
  incomeSources: values.incomeSources.trim() || null,
  deathsNotes: values.deathsNotes.trim() || null,
  inCrisis: values.inCrisis,
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

interface FamilyFormProps {
  values: FamilyFormValues;
  onChange: (values: FamilyFormValues) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  backTo: string;
}

export const FamilyForm: React.FC<FamilyFormProps> = ({
  values,
  onChange,
  onSubmit,
  errors,
  submitLabel,
  busyLabel,
  busy,
  backTo,
}) => {
  const { t } = useTranslation();

  const { data: communities = [], isLoading: communitiesLoading } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });

  const selectedCommunity = values.communityId
    ? communities.find((community) => community.id === Number(values.communityId))
    : undefined;
  const derivedSite =
    selectedCommunity && selectedCommunity.siteId
      ? sites.find((site) => site.id === selectedCommunity.siteId)?.title ?? t('common.unknown')
      : '—';

  const set = (patch: Partial<FamilyFormValues>) => onChange({ ...values, ...patch });

  const handleInput = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => set({ [event.target.name]: event.target.value } as Partial<FamilyFormValues>);

  if (communitiesLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

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
          <label htmlFor="familyName" className="block text-sm font-medium text-hv-charcoal mb-1">
            {t('families.col_name')}
          </label>
          <NameInput
            id="familyName"
            name="familyName"
            value={values.familyName}
            onChange={handleInput}
            maxLength={512}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta ${
              errors.familyName ? 'border-red-500' : 'border-hv-border-input'
            }`}
          />
          {errors.familyName && <p className="text-red-500 text-sm mt-1">{errors.familyName}</p>}
        </div>

        <div>
          <FormSelect
            label={t('families.col_community')}
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
            {t('families.col_site')}: <span className="text-hv-charcoal">{derivedSite}</span>
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

        <div>
          <label
            htmlFor="caretaker2Name"
            className="block text-sm font-medium text-hv-charcoal mb-1"
          >
            {t('families.caretaker2')}
          </label>
          <NameInput
            id="caretaker2Name"
            name="caretaker2Name"
            value={values.caretaker2Name}
            onChange={handleInput}
            maxLength={256}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta ${
              errors.caretaker2Name ? 'border-red-500' : 'border-hv-border-input'
            }`}
          />
          {errors.caretaker2Name && (
            <p className="text-red-500 text-sm mt-1">{errors.caretaker2Name}</p>
          )}
        </div>
      </div>

      <FormField
        label={t('families.income_sources')}
        name="incomeSources"
        value={values.incomeSources}
        onChange={handleInput}
        error={errors.incomeSources}
        rows={3}
      />

      <div className="flex items-center">
        <input
          type="checkbox"
          id="inCrisis"
          name="inCrisis"
          checked={values.inCrisis}
          onChange={(event) => set({ inCrisis: event.target.checked })}
          className="h-4 w-4 rounded border-hv-border-input text-hv-terracotta focus:ring-hv-terracotta"
        />
        <label htmlFor="inCrisis" className="ml-2 text-sm font-medium text-hv-charcoal">
          {t('families.col_crisis')}
        </label>
      </div>

      <FormField
        label={t('families.col_notes')}
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
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
};

export const AddFamilyPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FamilyFormValues>(EMPTY_FAMILY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createFamily = useMutation({
    mutationFn: (data: FamilyCreate) => familiesApi.createFamily(data),
    onSuccess: (family) => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      navigate(`/families/${family.id}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('families.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = FamilyCreateSchema.safeParse(familyFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    createFamily.mutate(result.data);
  };

  return (
    <div>
      <PageHeader
        title={t('add_family.title')}
        backTo="/families"
        backLabel={t('nav.families')}
      />
      <FamilyForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.create_family')}
        busyLabel={t('common.creating')}
        busy={createFamily.isPending}
        backTo="/families"
      />
    </div>
  );
};

export default AddFamilyPage;
