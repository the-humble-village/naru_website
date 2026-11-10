import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FamilyUpdateSchema, type FamilyUpdate } from '@naru/shared';
import { familiesApi } from '../../api/families';
import { LoadingState, PageHeader } from '../../components';
import { parseZodErrors, useTranslation } from '../../hooks';
import {
  EMPTY_FAMILY_FORM,
  FamilyForm,
  apiErrorMessage,
  familyFormToPayload,
  familyToFormValues,
  type FamilyFormValues,
} from './AddFamilyPage';

export const EditFamilyPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const familyId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<FamilyFormValues>(EMPTY_FAMILY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: family, isLoading, isError } = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => familiesApi.fetchFamily(familyId),
    enabled: Number.isFinite(familyId),
  });

  useEffect(() => {
    if (family && !loaded) {
      setValues(familyToFormValues(family));
      setLoaded(true);
    }
  }, [family, loaded]);

  const updateFamily = useMutation({
    mutationFn: (data: FamilyUpdate) => familiesApi.updateFamily(familyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      navigate(`/families/${familyId}`);
    },
    onError: (error) => {
      setErrors({ submit: apiErrorMessage(error, t('families.save_failed')) });
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const result = FamilyUpdateSchema.safeParse(familyFormToPayload(values));
    if (!result.success) {
      setErrors(parseZodErrors(result.error));
      return;
    }
    updateFamily.mutate(result.data);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (isError || !family) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('families.load_failed')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('families.edit_title')}
        backTo={`/families/${familyId}`}
        backLabel={family.familyName || t('common.unnamed')}
      />
      <FamilyForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        errors={errors}
        submitLabel={t('common.save_changes')}
        busyLabel={t('common.saving')}
        busy={updateFamily.isPending}
        backTo={`/families/${familyId}`}
      />
    </div>
  );
};

export default EditFamilyPage;
