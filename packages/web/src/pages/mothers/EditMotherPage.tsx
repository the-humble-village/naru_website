import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MotherUpdateSchema, type MotherUpdate } from '@naru/shared';
import { mothersApi } from '../../api/mothers';
import { LoadingState, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';
import {
  EMPTY_MOTHER_FORM,
  MotherForm,
  apiErrorMessage,
  motherFormToPayload,
  motherToFormValues,
  type MotherFormValues,
} from './AddMotherPage';

export const EditMotherPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const motherId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<MotherFormValues>(EMPTY_MOTHER_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: mother, isLoading, isError } = useQuery({
    queryKey: ['mother', motherId],
    queryFn: () => mothersApi.fetchMother(motherId),
    enabled: Number.isFinite(motherId),
  });

  useEffect(() => {
    if (mother && !loaded) {
      setValues(motherToFormValues(mother));
      setLoaded(true);
    }
  }, [mother, loaded]);

  const updateMother = useMutation({
    mutationFn: (data: MotherUpdate) => mothersApi.updateMother(motherId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mothers'] });
      queryClient.invalidateQueries({ queryKey: ['mother', motherId] });
      navigate(`/mothers/${motherId}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('mothers.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = MotherUpdateSchema.safeParse(motherFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    updateMother.mutate(result.data);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (isError || !mother) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('mothers.load_failed')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('mothers.edit')}
        backTo={`/mothers/${motherId}`}
        backLabel={mother.name}
      />
      <MotherForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.save_changes')}
        busy={updateMother.isPending}
        backTo={`/mothers/${motherId}`}
      />
    </div>
  );
};

export default EditMotherPage;
