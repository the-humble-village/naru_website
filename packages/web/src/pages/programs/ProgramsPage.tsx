import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ProgramKind, ProgramRead, SubjectType, TranslationKey } from '@naru/shared';
import { programsApi } from '../../api/programs';
import { EmptyState, LoadingState, PageHeader } from '../../components';
import { useTranslation } from '../../hooks';

const KIND_LABEL: Record<ProgramKind, TranslationKey> = {
  PREGNANCY: 'program.kind.PREGNANCY',
  NUTRITION: 'program.kind.NUTRITION',
  MIDWIFE: 'program.kind.MIDWIFE',
  STUDENT: 'program.kind.STUDENT',
  FAMILY_PAF: 'program.kind.FAMILY_PAF',
};

const SUBJECT_LABEL: Record<SubjectType, TranslationKey> = {
  MOTHER: 'subject_type.mother',
  CHILD: 'subject_type.child',
  PERSON: 'subject_type.person',
  FAMILY: 'subject_type.family',
};

// GET /programs returns activeEnrollmentCount alongside each row; the exported
// ListProgramsResponse does not declare it.
interface ProgramIndexItem extends ProgramRead {
  activeEnrollmentCount?: number;
}

export const ProgramsPage: React.FC = () => {
  const { t } = useTranslation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['programs', 'index'],
    queryFn: () => programsApi.listPrograms(),
  });

  const programs: ProgramIndexItem[] = data?.items ?? [];

  return (
    <div>
      <PageHeader title={t('nav.programs')} />

      {isLoading && <LoadingState message={t('common.loading')} />}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{t('programs.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && programs.length === 0 && (
        <EmptyState message={t('admin.programs_empty')} />
      )}

      {!isLoading && !isError && programs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Link
              key={program.id}
              to={`/programs/${program.id}`}
              className={`bg-white p-6 rounded-lg border shadow-sm transition-colors hover:border-hv-accent ${
                program.active ? 'border-hv-border' : 'border-dashed border-hv-border opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-hv-green">{program.name}</h2>
                {!program.active && (
                  <span className="shrink-0 rounded-full bg-hv-page px-2 py-1 text-xs font-medium text-hv-gray border border-hv-border">
                    {t('admin.program_inactive')}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-hv-gray">
                {t(KIND_LABEL[program.kind])} &middot; {t(SUBJECT_LABEL[program.subjectType])}
              </p>

              {program.description && (
                <p className="mt-2 text-sm text-hv-gray line-clamp-2">{program.description}</p>
              )}

              <div className="mt-4">
                <div className="text-4xl font-bold text-hv-green tabular-nums">
                  {program.activeEnrollmentCount ?? 0}
                </div>
                <div className="text-sm text-hv-gray mt-1">{t('programs.active_enrollments')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProgramsPage;
