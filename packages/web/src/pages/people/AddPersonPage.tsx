import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { PersonCreateSchema, type PersonCreate, type PersonRead } from '@naru/shared';
import { peopleApi } from '../../api/people';
import { adminApi } from '../../api/admin';
import { FormField, FormSelect, NameInput, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';

export interface PersonFormValues {
  name: string;
  birthDate: string;
  sex: string;
  communityId: string;
  phone: string;
  notes: string;
}

export const EMPTY_PERSON_FORM: PersonFormValues = {
  name: '',
  birthDate: '',
  sex: '',
  communityId: '',
  phone: '',
  notes: '',
};

export const personToFormValues = (person: PersonRead): PersonFormValues => ({
  name: person.name,
  birthDate: person.birthDate ? person.birthDate.slice(0, 10) : '',
  sex: person.sex ?? '',
  communityId: person.communityId ? String(person.communityId) : '',
  phone: person.phone ?? '',
  notes: person.notes ?? '',
});

export const personFormToPayload = (values: PersonFormValues): PersonCreate => ({
  name: values.name.trim(),
  birthDate: values.birthDate ? new Date(values.birthDate).toISOString() : null,
  sex: values.sex === 'MALE' || values.sex === 'FEMALE' ? values.sex : null,
  communityId: values.communityId ? Number(values.communityId) : null,
  phone: values.phone.trim() || null,
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

interface PersonFormProps {
  values: PersonFormValues;
  onChange: (values: PersonFormValues) => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  submitLabel: string;
  busy: boolean;
  backTo: string;
}

export const PersonForm: React.FC<PersonFormProps> = ({
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

  const selectedCommunity = values.communityId
    ? communities.find((community) => community.id === Number(values.communityId))
    : undefined;
  const derivedSite =
    selectedCommunity && selectedCommunity.siteId
      ? sites.find((site) => site.id === selectedCommunity.siteId)?.title ?? t('common.unknown')
      : '—';

  const handleInput = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => onChange({ ...values, [event.target.name]: event.target.value });

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

        <FormSelect
          label={t('form.sex')}
          name="sex"
          value={values.sex}
          onChange={handleInput}
          error={errors.sex}
          options={[
            { value: '', label: t('form.none') },
            { value: 'MALE', label: t('subject.sex_male') },
            { value: 'FEMALE', label: t('subject.sex_female') },
          ]}
        />

        <FormField
          label={t('form.phone')}
          name="phone"
          value={values.phone}
          onChange={handleInput}
          error={errors.phone}
          maxLength={64}
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

export const AddPersonPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<PersonFormValues>(EMPTY_PERSON_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPerson = useMutation({
    mutationFn: (data: PersonCreate) => peopleApi.createPerson(data),
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['unenrolled-count'] });
      navigate(`/people/${person.id}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('people.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = PersonCreateSchema.safeParse(personFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    createPerson.mutate(result.data);
  };

  return (
    <div>
      <PageHeader title={t('people.new_title')} backTo="/people" backLabel={t('nav.persons')} />
      <PersonForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('people.add')}
        busy={createPerson.isPending}
        backTo="/people"
      />
    </div>
  );
};

export default AddPersonPage;
