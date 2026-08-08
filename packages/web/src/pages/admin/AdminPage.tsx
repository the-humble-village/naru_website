import React from 'react';
import { Link } from 'react-router-dom';
import { RoleGate } from '../../components/RoleGate';
import { useTranslation } from '../../hooks';

interface AdminCardProps {
  to: string;
  icon: string;
  label: string;
  dashed?: boolean;
}

const AdminCard: React.FC<AdminCardProps> = ({ to, icon, label, dashed }) => (
  <Link to={to} className="block">
    <div
      className={`bg-white rounded-xl py-6 px-4 flex flex-col items-center justify-center hover:bg-hv-page transition-colors ${
        dashed ? 'border-2 border-dashed border-hv-border' : 'border border-hv-border'
      }`}
    >
      <i className={`${icon} text-hv-terracotta text-4xl mb-3`} />
      <span className="text-hv-charcoal text-sm font-medium text-center">{label}</span>
    </div>
  </Link>
);

/**
 * AdminPage - Admin menu with role-based access controls
 */
export const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">

      {/* People */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">{t('admin.section_people')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/users" icon="fas fa-users-gear" label={t('admin.my_team')} />
          </RoleGate>
          <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
            <AdminCard to="/admin/birthing-assistants" icon="fas fa-heart-pulse" label={t('admin.birthing_assistants')} />
          </RoleGate>
        </div>
      </section>

      {/* Lookup Tables */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">{t('admin.section_lookups')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/communities" icon="fas fa-location-dot" label={t('admin.communities')} />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/sites" icon="fas fa-layer-group" label={t('admin.sites')} />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/resources" icon="fas fa-book-open" label={t('admin.resources')} />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/training" icon="fas fa-graduation-cap" label={t('admin.training')} />
          </RoleGate>
        </div>
      </section>

      {/* Visit Questions */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">{t('admin.section_questions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/child" icon="fas fa-child-reaching" label={t('dash.child_visit')} />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/parent" icon="fas fa-person" label={t('dash.parent_visit')} />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/family" icon="fas fa-house-user" label={t('dash.family_visit')} />
          </RoleGate>
        </div>
      </section>

    </div>
  );
};

export default AdminPage;
