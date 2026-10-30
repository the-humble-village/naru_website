import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import type { ProgramKind, ProgramRead, SubjectType, TranslationKey } from '@naru/shared';
import { programsApi } from '../../api/programs';
import { EmptyState, LoadingState } from '../../components';
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

type Category = 'maternal' | 'nutrition' | 'community';

const sections: { category: Category; label: TranslationKey }[] = [
  { category: 'maternal', label: 'programs.category_maternal' },
  { category: 'nutrition', label: 'programs.category_nutrition' },
  { category: 'community', label: 'programs.category_community' },
];

// Group by kind so additional programs appear alongside related care.
const PROGRAM_STYLE: Record<ProgramKind, { category: Category; icon: string }> = {
  PREGNANCY: { category: 'maternal', icon: 'fa-person-pregnant' },
  MIDWIFE: { category: 'maternal', icon: 'fa-hands-holding-child' },
  NUTRITION: { category: 'nutrition', icon: 'fa-child-reaching' },
  STUDENT: { category: 'community', icon: 'fa-graduation-cap' },
  FAMILY_PAF: { category: 'community', icon: 'fa-people-roof' },
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
  const visibleSections = sections.map(section => ({
    ...section,
    programs: programs.filter(program => PROGRAM_STYLE[program.kind].category === section.category),
  })).filter(section => section.programs.length > 0);

  return (
    <div className="mx-auto max-w-7xl py-1">
      <header className="mb-5 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green sm:text-4xl">
          {t('nav.all_programs')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray sm:text-base">
          {t('programs.overview_description')}
        </p>
      </header>

      {isLoading && <LoadingState message={t('common.loading')} />}

      {isError && !isLoading && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-hv-crisis">{t('programs.load_failed')}</p>
        </div>
      )}

      {!isLoading && !isError && programs.length === 0 && (
        <EmptyState message={t('admin.programs_empty')} />
      )}

      {!isLoading && !isError && visibleSections.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {visibleSections.map(section => (
            <section
              key={section.category}
              aria-labelledby={`programs-${section.category}-heading`}
              className="flex min-w-0 flex-col rounded-2xl border border-hv-green/15 bg-[#eaf0e9] p-3"
            >
              <h2
                id={`programs-${section.category}-heading`}
                className="mb-3 text-center font-serif text-xl font-bold text-hv-green sm:text-2xl"
              >
                {t(section.label)}
              </h2>
              <ul className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {section.programs.map(program => {
                  const id = `program-${program.id}`;
                  const icon = program.kind === 'NUTRITION' && program.maxAgeMonths !== null && program.maxAgeMonths <= 6
                    ? 'fa-baby'
                    : PROGRAM_STYLE[program.kind].icon;

                  return (
                    <li key={program.id} className="min-w-0">
                      <Link
                        to={`/programs/${program.id}`}
                        aria-labelledby={`${id}-name`}
                        aria-describedby={[
                          `${id}-details`,
                          program.description ? `${id}-description` : '',
                          `${id}-enrollments`,
                          !program.active ? `${id}-inactive` : '',
                        ].filter(Boolean).join(' ')}
                        className={`flex h-full min-h-[184px] flex-col rounded-xl border border-hv-green/15 bg-white transition-[border-color,box-shadow] hover:border-hv-green hover:shadow-[0_4px_12px_rgba(47,79,57,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2 focus-visible:ring-offset-[#eaf0e9] motion-reduce:transition-none ${program.active ? '' : 'border-dashed'}`}
                      >
                        <div className="flex flex-1 items-start gap-3 p-4">
                          <span aria-hidden="true" className="flex h-12 w-10 shrink-0 items-center justify-center text-hv-terracotta">
                            <i className={`fas ${icon} text-4xl`} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 id={`${id}-name`} className="break-words text-base font-semibold leading-snug text-hv-green">
                              {program.name}
                            </h3>
                            <p id={`${id}-details`} className="mt-1 text-xs leading-5 text-hv-gray">
                              {t(KIND_LABEL[program.kind])} &middot; {t(SUBJECT_LABEL[program.subjectType])}
                            </p>
                            {program.description && (
                              <p id={`${id}-description`} className="mt-2 break-words text-sm leading-5 text-hv-gray">
                                {program.description}
                              </p>
                            )}
                            {!program.active && (
                              <span id={`${id}-inactive`} className="mt-2 inline-block rounded-full border border-hv-border bg-hv-page px-2 py-0.5 text-xs font-medium text-hv-gray">
                                {t('admin.program_inactive')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-hv-green/10 px-4 py-2.5">
                          <span id={`${id}-enrollments`} className="flex flex-wrap items-baseline gap-x-2 text-sm text-hv-gray">
                            <span className="text-3xl font-semibold leading-none tabular-nums text-hv-green">
                              {program.activeEnrollmentCount ?? 0}
                            </span>{' '}
                            {t('programs.active_enrollments')}
                          </span>
                          <ChevronRight aria-hidden="true" size={22} className="shrink-0 text-hv-green" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProgramsPage;
