import React from 'react';
import { Link } from 'react-router-dom';
import type { TranslationKey } from '@naru/shared';
import type { Role } from '../../components/RoleGate';
import { useTranslation } from '../../hooks';
import { useAuthStore } from '../../store/auth';

type Category = 'people' | 'programs' | 'reference';

const sections: { category: Category; label: TranslationKey }[] = [
  { category: 'people', label: 'admin.section_people' },
  { category: 'programs', label: 'admin.section_programs' },
  { category: 'reference', label: 'admin.reference_data' },
];

interface AdminCard {
  to: string;
  icon: string;
  label: TranslationKey;
  description: TranslationKey;
  category: Category;
  requiredRole: Role;
}

const cards: AdminCard[] = [
  { to: '/admin/users', icon: 'fas fa-users-gear', label: 'admin.my_team', description: 'admin.team_description', category: 'people', requiredRole: 'ADMIN' },
  { to: '/admin/birthing-assistants', icon: 'fas fa-heart-pulse', label: 'admin.birthing_assistants', description: 'admin.assistants_description', category: 'people', requiredRole: 'SUPERVISOR' },
  { to: '/admin/programs', icon: 'fas fa-folder-tree', label: 'admin.programs', description: 'admin.programs_description', category: 'programs', requiredRole: 'ADMIN' },
  { to: '/admin/question-sets', icon: 'fas fa-clipboard-question', label: 'admin.question_sets', description: 'admin.questions_description', category: 'programs', requiredRole: 'ADMIN' },
  { to: '/admin/communities', icon: 'fas fa-location-dot', label: 'admin.communities', description: 'admin.communities_description', category: 'reference', requiredRole: 'ADMIN' },
  { to: '/admin/sites', icon: 'fas fa-layer-group', label: 'admin.sites', description: 'admin.sites_description', category: 'reference', requiredRole: 'ADMIN' },
  { to: '/admin/resources', icon: 'fas fa-book-open', label: 'admin.resources', description: 'admin.resources_description', category: 'reference', requiredRole: 'ADMIN' },
  { to: '/admin/training', icon: 'fas fa-graduation-cap', label: 'admin.training', description: 'admin.training_description', category: 'reference', requiredRole: 'ADMIN' },
  { to: '/admin/examination-types', icon: 'fas fa-stethoscope', label: 'admin.examination_types', description: 'admin.examinations_description', category: 'reference', requiredRole: 'ADMIN' },
];

export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const availableCards = cards.filter(card =>
    user && (user.role === 'ADMIN' || user.role === card.requiredRole)
  );
  const visibleSections = sections
    .map(section => ({
      ...section,
      cards: availableCards.filter(card => card.category === section.category),
    }))
    .filter(section => section.cards.length > 0);

  return (
    <div className="mx-auto max-w-6xl py-1">
      <header className="mb-4 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green sm:text-4xl">
          {t('admin.overview_title')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray sm:text-base">
          {t('admin.overview_description')}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleSections.map(section => (
          <section
            key={section.category}
            aria-labelledby={`admin-${section.category}-heading`}
            className={`flex min-w-0 flex-col rounded-2xl border border-hv-green/15 bg-[#eaf0e9] p-3 ${
              section.category === 'reference' ? 'lg:col-span-2' : ''
            }`}
          >
            <h2
              id={`admin-${section.category}-heading`}
              className="mb-2 text-center font-serif text-xl font-bold text-hv-green"
            >
              {t(section.label)}
            </h2>
            <ul className={`grid flex-1 gap-3 ${
              section.category === 'reference'
                ? 'grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                : section.cards.length > 1 ? 'grid-cols-1 min-[400px]:grid-cols-2' : 'grid-cols-1'
            }`}>
              {section.cards.map(card => {
                const id = card.to.split('/').pop();
                return (
                  <li key={card.to} className="min-w-0">
                    <Link
                      to={card.to}
                      aria-labelledby={`admin-${id}-label`}
                      aria-describedby={`admin-${id}-description`}
                      className="flex h-full min-h-[132px] flex-col items-center rounded-xl border border-hv-green/15 bg-white p-3 text-center transition-[border-color,box-shadow] hover:border-hv-green hover:shadow-[0_4px_12px_rgba(47,79,57,0.16)] focus-visible:border-hv-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-4 focus-visible:ring-offset-[#eaf0e9] motion-reduce:transition-none"
                    >
                      <span aria-hidden="true" className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center text-hv-terracotta">
                        <i className={`${card.icon} text-3xl`} />
                      </span>
                      <h3 id={`admin-${id}-label`} className="text-base font-medium leading-snug text-hv-charcoal">
                        {t(card.label)}
                      </h3>
                      <p id={`admin-${id}-description`} className="mt-1 max-w-[15rem] text-sm leading-5 text-hv-gray">
                        {t(card.description)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};

export default AdminPage;
