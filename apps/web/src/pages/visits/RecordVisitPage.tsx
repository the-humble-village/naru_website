import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentRead, ProgramRead, Sex, VisitRead } from '@naru/shared';
import { enrollmentsApi } from '../../api/enrollments';
import { programsApi } from '../../api/programs';
import { childrenApi } from '../../api/children';
import { mothersApi } from '../../api/mothers';
import { peopleApi } from '../../api/people';
import { familiesApi } from '../../api/families';
import { LoadingState, PageHeader } from '../../components';
import VisitForm from '../../components/VisitForm';
import { useTranslation } from '../../hooks';

export interface VisitSubject {
  name: string;
  path: string;
  birthDate?: string | null;
  sex?: Sex | null;
}

export interface EnrollmentContext {
  enrollment: EnrollmentRead | undefined;
  program: ProgramRead | undefined;
  subject: VisitSubject | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolves an enrollment into the three things every visit screen needs: the
 * enrollment row, its program (for `kind`) and its one subject. Shared by
 * RecordVisitPage, EditVisitPage and VisitDetailPage so the four subject FKs are
 * unpacked in exactly one place.
 */
export const useEnrollmentContext = (enrollmentId: number): EnrollmentContext => {
  const { t } = useTranslation();

  const enrollmentQuery = useQuery({
    queryKey: ['enrollment', enrollmentId],
    queryFn: () => enrollmentsApi.fetchEnrollment(enrollmentId),
    enabled: enrollmentId > 0,
  });

  const enrollment = enrollmentQuery.data;
  const programId = enrollment?.programId ?? 0;
  const childId = enrollment?.childId ?? 0;
  const motherId = enrollment?.motherId ?? 0;
  const personId = enrollment?.personId ?? 0;
  const familyId = enrollment?.familyId ?? 0;

  const programQuery = useQuery({
    queryKey: ['program', programId],
    queryFn: () => programsApi.fetchProgram(programId),
    enabled: programId > 0,
  });

  const childQuery = useQuery({
    queryKey: ['child', childId],
    queryFn: () => childrenApi.fetchChild(childId),
    enabled: childId > 0,
  });

  const motherQuery = useQuery({
    queryKey: ['mother', motherId],
    queryFn: () => mothersApi.fetchMother(motherId),
    enabled: motherId > 0,
  });

  const personQuery = useQuery({
    queryKey: ['person', personId],
    queryFn: () => peopleApi.fetchPerson(personId),
    enabled: personId > 0,
  });

  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => familiesApi.fetchFamily(familyId),
    enabled: familyId > 0,
  });

  const child = childQuery.data;
  const mother = motherQuery.data;
  const person = personQuery.data;
  const family = familyQuery.data;

  const unnamed = t('common.unnamed');

  const subject = useMemo<VisitSubject | null>(() => {
    if (child) {
      return {
        name: child.name,
        path: `/children/${child.id}`,
        birthDate: child.birthDate,
        sex: child.sex,
      };
    }
    if (mother) return { name: mother.name, path: `/mothers/${mother.id}` };
    if (person) return { name: person.name, path: `/people/${person.id}` };
    if (family) {
      return { name: family.familyName || unnamed, path: `/families/${family.id}` };
    }
    return null;
  }, [child, mother, person, family, unnamed]);

  return {
    enrollment,
    program: programQuery.data,
    subject,
    isLoading:
      enrollmentQuery.isLoading ||
      programQuery.isLoading ||
      childQuery.isLoading ||
      motherQuery.isLoading ||
      personQuery.isLoading ||
      familyQuery.isLoading,
    isError: enrollmentQuery.isError || programQuery.isError,
  };
};

export const RecordVisitPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const enrollmentId = id ? parseInt(id, 10) : 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { program, subject, isLoading, isError } = useEnrollmentContext(enrollmentId);

  const returnTo = subject?.path ?? `/enrollments/${enrollmentId}`;

  const handleSaved = (saved: VisitRead): void => {
    queryClient.invalidateQueries({ queryKey: ['visits'] });
    queryClient.invalidateQueries({ queryKey: ['visit', saved.id] });
    queryClient.invalidateQueries({ queryKey: ['enrollment', enrollmentId] });
    navigate(returnTo);
  };

  if (isLoading) {
    return <LoadingState message={t('common.loading')} />;
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
      <PageHeader title={t('visit.record_visit')} backTo={returnTo} backLabel={backLabel} />

      <VisitForm
        enrollmentId={enrollmentId}
        program={{ id: program.id, kind: program.kind, name: program.name }}
        subject={
          program.subjectType === 'CHILD' && subject
            ? { birthDate: subject.birthDate, sex: subject.sex }
            : null
        }
        onSaved={handleSaved}
        onCancel={() => navigate(returnTo)}
      />
    </div>
  );
};

export default RecordVisitPage;
