import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi } from '../../api/sites';
import { type SiteRead } from '@naru/shared';
import { MapPicker, RoleGate, ConfirmDialog, type MapPickerValue } from '../../components';
import { useTranslation } from '../../hooks';

interface SiteFormProps {
  initial?: SiteRead;
  onSave: () => void;
  onCancel: () => void;
}

const SiteForm: React.FC<SiteFormProps> = ({ initial, onSave, onCancel }) => {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [mapVal, setMapVal] = useState<MapPickerValue>({
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
    boundary: initial?.boundary ?? null,
  });
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const data = {
        title,
        lat: mapVal.lat,
        lng: mapVal.lng,
        boundary: mapVal.boundary,
      };
      return initial ? sitesApi.update(initial.id, data) : sitesApi.create({ ...data, title });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); onSave(); },
    onError: () => setError('Failed to save. Please try again.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Name is required'); return; }
    setError('');
    save.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-hv-charcoal mb-1">Site Name *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Clinic Alpha"
          className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-hv-charcoal mb-2">Location</label>
        <p className="text-xs text-hv-sage mb-3">
          Place a pin for a single point, draw a boundary to mark a service area, or both.
        </p>
        <MapPicker value={mapVal} onChange={setMapVal} />
      </div>

      {error && <p className="text-hv-crisis text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="bg-hv-green text-white px-5 py-2 rounded hover:bg-hv-green-hover disabled:opacity-50 transition-colors"
        >
          {save.isPending ? t('common.saving') : initial ? t('common.update_site') : t('common.create_site')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-hv-gray text-white px-5 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
};

export const AdminSitesPage: React.FC = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SiteRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteRead | null>(null);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => sitesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      // Sites also show up in the generic lookup admin screen.
      qc.invalidateQueries({ queryKey: ['admin', 'sites'] });
      setDeleteTarget(null);
    },
  });

  const handleSaved = () => { setShowForm(false); setEditing(null); };

  const askDelete = (site: SiteRead) => { deleteMut.reset(); setDeleteTarget(site); };
  const cancelDelete = () => { setDeleteTarget(null); deleteMut.reset(); };
  const confirmDelete = () => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); };

  return (
    <RoleGate requiredRole="ADMIN">
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Sites</h1>
        <div className="flex gap-3 items-center">
          <Link to="/admin" className="text-hv-terracotta hover:underline transition-colors text-sm">← Back to Admin</Link>
          {!showForm && !editing && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors text-sm"
            >
              + Add Site
            </button>
          )}
        </div>
      </div>

      {(showForm || editing) && (
        <div className="bg-white p-6 rounded-xl border border-hv-border mb-6">
          <h2 className="text-lg font-semibold text-hv-green mb-4">
            {editing ? `Edit "${editing.title}"` : 'New Site'}
          </h2>
          <SiteForm initial={editing ?? undefined} onSave={handleSaved} onCancel={handleSaved} />
        </div>
      )}

      {isLoading ? (
        <p className="text-hv-gray">Loading...</p>
      ) : sites.length === 0 ? (
        <p className="text-hv-gray text-center py-8">No sites yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-hv-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-hv-page">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-hv-sage uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hv-border">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-hv-page">
                  <td className="px-6 py-4 font-medium text-hv-charcoal">{site.title}</td>
                  <td className="px-6 py-4 text-sm text-hv-sage">
                    {site.lat != null && site.lng != null ? (
                      <span className="inline-flex items-center gap-1">
                        <span>📍</span>
                        {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                        {site.boundary && site.boundary.length >= 3 && (
                          <span className="ml-2">🔷 {site.boundary.length} pt boundary</span>
                        )}
                      </span>
                    ) : site.boundary && site.boundary.length >= 3 ? (
                      <span>🔷 {site.boundary.length} pt boundary</span>
                    ) : (
                      <span className="text-hv-border">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm space-x-3">
                    <button
                      onClick={() => { setEditing(site); setShowForm(false); }}
                      className="text-hv-accent hover:text-hv-green transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => askDelete(site)}
                      disabled={deleteMut.isPending}
                      className="text-hv-crisis hover:text-red-700 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Site"
        message={
          <>
            <p>
              Delete <span className="font-medium text-hv-charcoal">&ldquo;{deleteTarget?.title}&rdquo;</span>? Its pin
              and boundary will be removed from the map and it will no longer be selectable for families.
            </p>
            {deleteMut.error && (
              <p className="mt-2 text-hv-crisis">Failed to delete site: {deleteMut.error.message}</p>
            )}
          </>
        }
        warning="Families already assigned to this site keep their current value — they are not changed or removed."
        busy={deleteMut.isPending}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
    </RoleGate>
  );
};

export default AdminSitesPage;
