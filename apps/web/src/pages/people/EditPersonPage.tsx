import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PersonUpdateSchema, type PersonUpdate } from '@naru/shared';
import { peopleApi } from '../../api/people';
import { LoadingState, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';
import {
  EMPTY_PERSON_FORM,
  PersonForm,
  apiErrorMessage,
  personFormToPayload,
  personToFormValues,
  type PersonFormValues,
} from './AddPersonPage';

export const EditPersonPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const personId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<PersonFormValues>(EMPTY_PERSON_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: person, isLoading, isError } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => peopleApi.fetchPerson(personId),
    enabled: Number.isFinite(personId),
  });

  useEffect(() => {
    if (person && !loaded) {
      setValues(personToFormValues(person));
      setLoaded(true);
    }
  }, [person, loaded]);

  const updatePerson = useMutation({
    mutationFn: (data: PersonUpdate) => peopleApi.updatePerson(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['person', personId] });
      navigate(`/people/${personId}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('people.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = PersonUpdateSchema.safeParse(personFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    updatePerson.mutate(result.data);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (isError || !person) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('people.load_failed')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('people.edit')} backTo={`/people/${personId}`} backLabel={person.name} />
      <PersonForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.save_changes')}
        busy={updatePerson.isPending}
        backTo={`/people/${personId}`}
      />
    </div>
  );
};

export default EditPersonPage;
