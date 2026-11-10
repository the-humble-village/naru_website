import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { visitsApi } from '../../api/visits';
import { LoadingState, PageHeader } from '../../components';
import VisitForm from '../../components/VisitForm';
import { useTranslation } from '../../hooks';
import { useEnrollmentContext } from './RecordVisitPage';

export const EditVisitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const visitId = id ? parseInt(id, 10) : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const {
    data: visit,
    isLoading: visitLoading,
    isError: visitError,
  } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => visitsApi.fetchVisit(visitId),
    enabled: visitId > 0,
  });

  const enrollmentId = visit?.enrollmentId ?? 0;
  const { program, subject, isLoading, isError } = useEnrollmentContext(enrollmentId);

  const returnTo = `/visits/${visitId}`;

  const handleSaved = (): void => {
    queryClient.invalidateQueries({ queryKey: ['visits'] });
    queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
    queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    navigate(returnTo);
  };

  if (visitLoading || isLoading) {
    return <LoadingState message={t('common.loading')} />;
  }

  if (visitError || !visit) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('visit.detail_load_failed')}</p>
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-hv-crisis">{t('visit.enrollment_load_failed')}</p>
      </div>
    );
  }

  const backLabel = subject ? `${subject.name} · ${program.name}` : program.name;

  return (
    <div>
      <PageHeader title={t('visit.edit_visit')} backTo={returnTo} backLabel={backLabel} />

      <VisitForm
        enrollmentId={visit.enrollmentId}
        program={{ id: program.id, kind: program.kind, name: program.name }}
        subject={
          program.subjectType === 'CHILD' && subject
            ? { birthDate: subject.birthDate, sex: subject.sex }
            : null
        }
        visit={visit}
        onSaved={handleSaved}
        onCancel={() => navigate(returnTo)}
      />
    </div>
  );
};

export default EditVisitPage;
