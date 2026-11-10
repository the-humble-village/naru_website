import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChildUpdateSchema, type ChildUpdate } from '@naru/shared';
import { childrenApi } from '../../api/children';
import { LoadingState, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';
import {
  ChildForm,
  EMPTY_CHILD_FORM,
  apiErrorMessage,
  childFormToPayload,
  childToFormValues,
  type ChildFormValues,
} from './AddChildPage';

export const EditChildPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const childId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<ChildFormValues>(EMPTY_CHILD_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: child, isLoading, isError } = useQuery({
    queryKey: ['child', childId],
    queryFn: () => childrenApi.fetchChild(childId),
    enabled: Number.isFinite(childId),
  });

  useEffect(() => {
    if (child && !loaded) {
      setValues(childToFormValues(child));
      setLoaded(true);
    }
  }, [child, loaded]);

  const updateChild = useMutation({
    mutationFn: (data: ChildUpdate) => childrenApi.updateChild(childId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children'] });
      queryClient.invalidateQueries({ queryKey: ['child', childId] });
      navigate(`/children/${childId}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('children.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = ChildUpdateSchema.safeParse(childFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    updateChild.mutate(result.data);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (isError || !child) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('children.load_failed')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('children.edit')}
        backTo={`/children/${childId}`}
        backLabel={child.name}
      />
      <ChildForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.save_changes')}
        busy={updateChild.isPending}
        backTo={`/children/${childId}`}
      />
    </div>
  );
};

export default EditChildPage;
