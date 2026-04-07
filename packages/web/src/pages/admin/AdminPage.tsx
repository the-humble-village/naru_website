import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleGate } from '../../components/RoleGate';
import { generateTestData } from '../../api/seed';

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

interface AdminButtonCardProps {
  icon: string;
  label: string;
  dashed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const AdminButtonCard: React.FC<AdminButtonCardProps> = ({ icon, label, dashed, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="block w-full text-left">
    <div
      className={`bg-white rounded-xl py-6 px-4 flex flex-col items-center justify-center transition-colors ${
        dashed ? 'border-2 border-dashed border-hv-border' : 'border border-hv-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hv-page cursor-pointer'}`}
    >
      <i className={`${icon} text-hv-terracotta text-4xl mb-3`} />
      <span className="text-hv-charcoal text-sm font-medium text-center">{label}</span>
    </div>
  </button>
);

/**
 * AdminPage - Admin menu with role-based access controls
 */
export const AdminPage: React.FC = () => {
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  const handleGenerateTestData = async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedStatus(null);
    try {
      const result = await generateTestData();
      setSeedStatus(
        `Created ${result.created.families} families, ${result.created.children} children, ${result.created.childVisits} child visits, ${result.created.familyVisits} family visits, ${result.created.communities} communities`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate test data';
      setSeedStatus(message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* People */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">People</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/users" icon="fas fa-users-gear" label="My Team" />
          </RoleGate>
          <RoleGate requiredRole={['SUPERVISOR', 'ADMIN']}>
            <AdminCard to="/admin/birthing-assistants" icon="fas fa-heart-pulse" label="Birthing Assistants" />
          </RoleGate>
        </div>
      </section>

      {/* Lookup Tables */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">Lookup Tables</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/communities" icon="fas fa-location-dot" label="Communities" />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/sites" icon="fas fa-layer-group" label="Sites" />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/resources" icon="fas fa-book-open" label="Resources" />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/training" icon="fas fa-graduation-cap" label="Training" />
          </RoleGate>
        </div>
      </section>

      {/* Visit Questions */}
      <section>
        <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">Visit Questions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/child" icon="fas fa-child-reaching" label="Child Visit" />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/parent" icon="fas fa-person" label="Parent Visit" />
          </RoleGate>
          <RoleGate requiredRole="ADMIN">
            <AdminCard to="/admin/question-sets/family" icon="fas fa-house-user" label="Family Visit" />
          </RoleGate>
        </div>
      </section>

      {/* Developer Tools */}
      <RoleGate requiredRole="ADMIN">
        <section>
          <h2 className="text-xs font-semibold text-hv-sage uppercase tracking-widest mb-3">Developer Tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <AdminButtonCard
              icon={seeding ? 'fas fa-spinner fa-spin' : 'fas fa-flask'}
              label={seeding ? 'Generating...' : 'Generate Test Data'}
              dashed
              onClick={handleGenerateTestData}
              disabled={seeding}
            />
          </div>
          {seedStatus && (
            <div className="mt-3 p-3 rounded-xl border border-hv-border bg-white text-sm text-hv-charcoal">
              {seedStatus}
            </div>
          )}
        </section>
      </RoleGate>

    </div>
  );
};

export default AdminPage;
