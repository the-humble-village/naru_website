import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChildCreateSchema, type ChildCreate, type ChildRead, type Sex } from '@naru/shared';
import { childrenApi } from '../../api/children';
import { mothersApi } from '../../api/mothers';
import { familiesApi } from '../../api/families';
import { adminApi } from '../../api/admin';
import { FormField, FormSelect, NameInput, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';

export interface ChildFormValues {
  name: string;
  birthDate: string;
  sex: Sex;
  communityId: string;
  motherId: string;
  familyId: string;
  notes: string;
}

export const EMPTY_CHILD_FORM: ChildFormValues = {
  name: '',
  birthDate: '',
  sex: 'MALE',
  communityId: '',
  motherId: '',
  familyId: '',
  notes: '',
};

export const childToFormValues = (child: ChildRead): ChildFormValues => ({
  name: child.name,
  birthDate: child.birthDate ? child.birthDate.slice(0, 10) : '',
  sex: child.sex,
  communityId: child.communityId ? String(child.communityId) : '',
  motherId: child.motherId ? String(child.motherId) : '',
  familyId: child.familyId ? String(child.familyId) : '',
  notes: child.notes ?? '',
});

export const childFormToPayload = (values: ChildFormValues) => ({
  name: values.name.trim(),
  birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : '',
  sex: values.sex,
  communityId: values.communityId ? Number(values.communityId) : null,
  motherId: values.motherId ? Number(values.motherId) : null,
  familyId: values.familyId ? Number(values.familyId) : null,
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

interface ChildFormProps {
  values: ChildFormValues;
  onChange: (values: ChildFormValues) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  submitLabel: string;
  busy: boolean;
  backTo: string;
}

export const ChildForm: React.FC<ChildFormProps> = ({
  values,
  onChange,
  onSubmit,
  errors,
  submitLabel,
  busy,
  backTo,
}) => {
  const { t } = useTranslation();
  const [motherSearch, setMotherSearch] = useState('');

  const { data: communities = [] } = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: adminApi.fetchSites });
  const { data: mothers } = useQuery({
    queryKey: ['mothers', { search: motherSearch.trim() || undefined, limit: 100 }],
    queryFn: () =>
      mothersApi.listMothers({ search: motherSearch.trim() || undefined, limit: 100 }),
  });
  const { data: families } = useQuery({
    queryKey: ['families', { limit: 100 }],
    queryFn: () => familiesApi.listFamilies({ limit: 100 }),
  });

  const selectedCommunity = values.communityId
    ? communities.find((community) => community.id === Number(values.communityId))
    : undefined;
  const derivedSite =
    selectedCommunity && selectedCommunity.siteId
      ? sites.find((site) => site.id === selectedCommunity.siteId)?.title ?? t('common.unknown')
      : '—';

  const handleInput = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    if (name === 'sex') {
      onChange({ ...values, sex: value === 'FEMALE' ? 'FEMALE' : 'MALE' });
      return;
    }
    onChange({ ...values, [name]: value });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="bg-white p-6 rounded-xl border border-hv-border space-y-6"
    >
      <p className="text-sm text-hv-gray">{t('children.optional_hint')}</p>

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
          required
        />

        <FormSelect
          label={t('form.sex')}
          name="sex"
          value={values.sex}
          onChange={handleInput}
          error={errors.sex}
          required
          options={[
            { value: 'MALE', label: t('subject.sex_male') },
            { value: 'FEMALE', label: t('subject.sex_female') },
          ]}
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

        <div>
          <label htmlFor="motherSearch" className="block text-sm font-medium text-hv-charcoal mb-1">
            {t('form.mother')}
          </label>
          <input
            id="motherSearch"
            type="search"
            value={motherSearch}
            onChange={(event) => setMotherSearch(event.target.value)}
            placeholder={t('form.mother_search_placeholder')}
            className="w-full px-3 py-2 mb-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          />
          <select
            id="motherId"
            name="motherId"
            value={values.motherId}
            onChange={handleInput}
            className="w-full px-3 py-2 border border-hv-border-input rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
          >
            <option value="">{t('form.none')}</option>
            {(mothers?.items ?? []).map((mother) => (
              <option key={mother.id} value={String(mother.id)}>
                {mother.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-hv-gray mt-1">{t('children.mother_optional_hint')}</p>
        </div>

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
      </div>

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

/**
 * AddChildPage - a child can be admitted with no mother and no family at all,
 * so `familyId` arrives as an optional query param rather than a route param.
 */
export const AddChildPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const familyIdParam = searchParams.get('familyId');
  const familyIdNum = familyIdParam ? parseInt(familyIdParam, 10) : 0;
  const backTo = familyIdNum ? `/families/${familyIdNum}` : '/children';

  const [values, setValues] = useState<ChildFormValues>({
    ...EMPTY_CHILD_FORM,
    familyId: familyIdNum ? String(familyIdNum) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createChild = useMutation({
    mutationFn: (data: ChildCreate) => childrenApi.createChild(data),
    onSuccess: (child) => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      // A brand-new child has no enrollment, so the unenrolled worklist and its
      // sidebar badge have to be refreshed.
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      if (familyIdNum) queryClient.invalidateQueries({ queryKey: ['family', familyIdNum] });
      navigate(`/children/${child.id}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('children.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = ChildCreateSchema.safeParse(childFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    createChild.mutate(result.data);
  };

  return (
    <div>
      <PageHeader
        title={t('families.add_child')}
        backTo={backTo}
        backLabel={familyIdNum ? t('nav.families') : t('nav.children')}
      />
      <ChildForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.add_child')}
        busy={createChild.isPending}
        backTo={backTo}
      />
    </div>
  );
};

export default AddChildPage;
