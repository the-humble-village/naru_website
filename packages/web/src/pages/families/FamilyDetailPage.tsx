import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { familiesApi } from '../../api/families';
import { parentsApi } from '../../api/parents';
import { childrenApi } from '../../api/children';
import { visitsApi } from '../../api/visits';
import { adminApi } from '../../api/admin';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { FamilyUpdate, SiteRead } from '@naru/shared';
import { PhotoUpload, PhotoGallery } from '../../components';
import { AlertTriangle, Users, Baby, CalendarCheck, Pencil, Trash2, Plus, ChevronRight, UserRound, PersonStanding, Heart, MapPin, X } from 'lucide-react';

// Fix Leaflet default marker icons broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ageLabel(dateStr: string | null): string {
  if (!dateStr) return '';
  const birth = new Date(dateStr);
  const now = new Date();
  const months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + (now.getUTCMonth() - birth.getUTCMonth());
  if (months < 1) return '< 1 mo';
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

// Calendar dates (birthDate, dueDate, visitDate) are stored as UTC midnight, so
// render them in UTC to avoid the local-timezone shift that pushes them back a day.
const formatDateOnly = (d: string) => new Date(d).toLocaleDateString(undefined, { timeZone: 'UTC' });

function roleIcon(role: string | null) {
  const r = (role ?? '').toLowerCase();
  if (r.includes('mother') || r.includes('mom') || r.includes('madre')) return <Heart size={16} className="text-hv-terracotta" />;
  if (r.includes('father') || r.includes('dad') || r.includes('padre')) return <PersonStanding size={16} className="text-hv-sage" />;
  return <UserRound size={16} className="text-hv-sage" />;
}

/**
 * FamilyDetailPage - Compact dashboard-style view of family info, members, and visits
 */
export const FamilyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<FamilyUpdate>({});
  const [mapSite, setMapSite] = useState<SiteRead | null>(null);

  const familyId = id ? parseInt(id, 10) : 0;

  const familyQuery = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => familiesApi.fetchFamily(familyId),
    enabled: !!familyId,
  });

  const parentsQuery = useQuery({
    queryKey: ['parents', familyId],
    queryFn: () => parentsApi.listParents(familyId),
    enabled: !!familyId,
  });

  const childrenQuery = useQuery({
    queryKey: ['children', familyId],
    queryFn: () => childrenApi.listChildren(familyId),
    enabled: !!familyId,
  });

  const visitsQuery = useQuery({
    queryKey: ['familyVisits', familyId],
    queryFn: () => visitsApi.listFamilyVisits(familyId, { limit: 5 }),
    enabled: !!familyId,
  });

  const communitiesQuery = useQuery({
    queryKey: ['communities'],
    queryFn: adminApi.fetchCommunities,
  });

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: adminApi.fetchSites,
  });

  const birthingAssistantsQuery = useQuery({
    queryKey: ['birthingAssistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
  });

  const updateFamilyMutation = useMutation({
    mutationFn: (data: FamilyUpdate) => familiesApi.updateFamily(familyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      setIsEditing(false);
      setEditData({});
    },
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: () => familiesApi.deleteFamily(familyId),
    onSuccess: () => navigate('/'),
  });

  if (!familyId) return <div className="text-red-500">Invalid family ID</div>;
  if (familyQuery.isLoading) return <div className="text-hv-gray">Loading...</div>;
  if (familyQuery.isError) return <div className="text-red-500">Error loading family</div>;

  const family = familyQuery.data!;
  const parents = parentsQuery.data || [];
  const children = childrenQuery.data || [];
  const visits = visitsQuery.data?.visits || [];
  const communities = communitiesQuery.data || [];
  const sites = sitesQuery.data || [];
  const birthingAssistants = birthingAssistantsQuery.data || [];

  const communityName = communities.find(c => c.id === family.communityId)?.title;
  const site = sites.find(s => s.id === family.siteId) ?? null;
  const siteName = site?.title;
  const baName = birthingAssistants.find(ba => ba.id === family.birthingAssistantId)?.name;

  const handleEdit = () => {
    setIsEditing(true);
    setEditData({
      familyName: family.familyName,
      childrenEditable: family.childrenEditable,
      inCrisis: family.inCrisis,
      notes: family.notes,
      communityId: family.communityId,
      siteId: family.siteId,
      birthingAssistantId: family.birthingAssistantId,
      photos: family.photos ?? [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFamilyMutation.mutate(editData);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this family? This cannot be undone.')) {
      deleteFamilyMutation.mutate();
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to="/" className="text-xs text-hv-sage hover:text-hv-charcoal transition-colors">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-serif font-bold text-hv-charcoal">
              {family.familyName || 'Unnamed Family'}
            </h1>
            {family.inCrisis && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle size={11} />
                In Crisis
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteFamilyMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 rounded-md text-hv-crisis hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      </div>

      {isEditing ? (
        /* ── Edit form ── */
        <div className="bg-white p-5 rounded-xl border border-hv-border mb-5">
          <h2 className="text-sm font-semibold text-hv-charcoal mb-4">Edit Family</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="familyName" className="block text-xs font-medium text-hv-charcoal mb-1">Family Name</label>
                <input
                  id="familyName"
                  type="text"
                  value={editData.familyName || ''}
                  onChange={(e) => setEditData({ ...editData, familyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                />
              </div>
              <div>
                <label htmlFor="communityId" className="block text-xs font-medium text-hv-charcoal mb-1">Community</label>
                <select
                  id="communityId"
                  value={editData.communityId || ''}
                  onChange={(e) => setEditData({ ...editData, communityId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">None</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-hv-charcoal mb-1">Site</label>
                <select
                  value={editData.siteId || ''}
                  onChange={(e) => setEditData({ ...editData, siteId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">None</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-hv-charcoal mb-1">Birthing Assistant</label>
                <select
                  value={editData.birthingAssistantId || ''}
                  onChange={(e) => setEditData({ ...editData, birthingAssistantId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">None</option>
                  {birthingAssistants.map(ba => <option key={ba.id} value={ba.id}>{ba.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-hv-charcoal mb-1">Children (editable count)</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, childrenEditable: Math.max(0, (editData.childrenEditable ?? 0) - 1) })}
                    className="w-8 h-8 flex items-center justify-center border border-hv-border-input rounded-md text-hv-charcoal hover:bg-hv-page transition-colors text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-hv-charcoal">
                    {editData.childrenEditable ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, childrenEditable: (editData.childrenEditable ?? 0) + 1 })}
                    className="w-8 h-8 flex items-center justify-center border border-hv-border-input rounded-md text-hv-charcoal hover:bg-hv-page transition-colors text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="inCrisis"
                  checked={editData.inCrisis || false}
                  onChange={(e) => setEditData({ ...editData, inCrisis: e.target.checked })}
                  className="rounded border-hv-border-input text-hv-crisis focus:ring-hv-accent"
                />
                <label htmlFor="inCrisis" className="text-sm text-hv-charcoal">Family in Crisis</label>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-hv-charcoal mb-1">Notes</label>
              <textarea
                value={editData.notes || ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
              />
            </div>
            <div className="mb-4">
              <PhotoUpload
                photos={(editData.photos as number[]) ?? []}
                onChange={(photos) => setEditData({ ...editData, photos })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateFamilyMutation.isPending}
                className="px-4 py-2 text-sm bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateFamilyMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditData({}); }}
                className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ── Info strip ── */
        <div className="bg-white rounded-xl border border-hv-border mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-hv-border">
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Community</div>
              <div className="text-sm font-medium text-hv-charcoal">{communityName || <span className="text-hv-sage italic">None</span>}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Site</div>
              {site?.lat && site?.lng ? (
                <button
                  onClick={() => setMapSite(site)}
                  className="flex items-center gap-1 text-sm font-medium text-hv-terracotta hover:underline"
                >
                  <MapPin size={13} />
                  {siteName}
                </button>
              ) : (
                <div className="text-sm font-medium text-hv-charcoal">{siteName || <span className="text-hv-sage italic">None</span>}</div>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Birthing Assistant</div>
              <div className="text-sm font-medium text-hv-charcoal">{baName || <span className="text-hv-sage italic">None</span>}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Updated</div>
              <div className="text-sm font-medium text-hv-charcoal">{new Date(family.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
          {family.notes && (
            <div className="px-4 py-3 border-t border-hv-border">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Notes</div>
              <div className="text-sm text-hv-charcoal">{family.notes}</div>
            </div>
          )}
          {family.photos && family.photos.length > 0 && (
            <div className="px-4 py-3 border-t border-hv-border">
              <PhotoGallery photos={family.photos} />
            </div>
          )}
        </div>
      )}

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">

          {/* Parents */}
          <div className="bg-white rounded-xl border border-hv-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
              <h2 className="text-sm font-semibold text-hv-charcoal flex items-center gap-1.5">
                <Users size={15} className="text-hv-sage" />
                Parents
                {parents.length > 0 && (
                  <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">{parents.length}</span>
                )}
              </h2>
              <Link
                to={`/families/${id}/parents/new`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                <Plus size={12} />
                Add Parent
              </Link>
            </div>
            {parentsQuery.isLoading ? (
              <div className="px-4 py-3 text-sm text-hv-sage">Loading...</div>
            ) : parents.length === 0 ? (
              <div className="px-4 py-4 text-sm text-hv-sage text-center">No parents added yet</div>
            ) : (
              <div className={`grid gap-px bg-hv-border ${parents.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {parents.map(parent => (
                  <Link
                    key={parent.id}
                    to={`/families/${id}/parents/${parent.id}`}
                    className="flex flex-col gap-2 px-5 py-4 bg-white hover:bg-hv-page transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-hv-page flex items-center justify-center shrink-0">
                        {roleIcon(parent.role)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-hv-charcoal group-hover:text-hv-green transition-colors truncate">
                          {parent.name || 'Unnamed Parent'}
                        </div>
                        {parent.role && (
                          <div className="text-xs text-hv-sage capitalize">{parent.role}</div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-hv-border group-hover:text-hv-sage transition-colors ml-auto shrink-0" />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-hv-sage pl-10">
                      {parent.birthDate && (
                        <span>{formatDateOnly(parent.birthDate)} · {ageLabel(parent.birthDate)}</span>
                      )}
                      {parent.dueDate && (
                        <span className="text-hv-terracotta">Due {formatDateOnly(parent.dueDate)}</span>
                      )}
                    </div>
                    {parent.notes && (
                      <p className="text-xs text-hv-gray pl-10 line-clamp-2">{parent.notes}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Children */}
          <div className="bg-white rounded-xl border border-hv-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
              <h2 className="text-sm font-semibold text-hv-charcoal flex items-center gap-1.5">
                <Baby size={15} className="text-hv-sage" />
                Children
                {children.length > 0 && (
                  <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">{children.length}</span>
                )}
              </h2>
              <Link
                to={`/families/${id}/children/new`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                <Plus size={12} />
                Add Child
              </Link>
            </div>
            {childrenQuery.isLoading ? (
              <div className="px-4 py-3 text-sm text-hv-sage">Loading...</div>
            ) : children.length === 0 ? (
              <div className="px-4 py-3 text-sm text-hv-sage">No children added yet</div>
            ) : (
              <div className="divide-y divide-hv-border">
                {children.map(child => (
                  <Link
                    key={child.id}
                    to={`/families/${id}/children/${child.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-hv-page transition-colors group"
                  >
                    <div>
                      <span className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green transition-colors">
                        {child.name}
                      </span>
                      <span className="ml-2 text-xs text-hv-sage">
                        {child.sex} • {ageLabel(child.birthDate)} • {formatDateOnly(child.birthDate)}
                        {child.weight > 0 && ` • ${child.weight.toFixed(1)} kg`}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-hv-border group-hover:text-hv-sage transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visits */}
        <div className="bg-white rounded-xl border border-hv-border self-start">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
            <h2 className="text-sm font-semibold text-hv-charcoal flex items-center gap-1.5">
              <CalendarCheck size={15} className="text-hv-sage" />
              Recent Visits
            </h2>
            <Link
              to={`/families/${id}/visits/new`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              <Plus size={12} />
              Add Visit
            </Link>
          </div>
          {visitsQuery.isLoading ? (
            <div className="px-4 py-3 text-sm text-hv-sage">Loading...</div>
          ) : visits.length === 0 ? (
            <div className="px-4 py-3 text-sm text-hv-sage">No visits recorded yet</div>
          ) : (
            <>
              <div className="divide-y divide-hv-border">
                {visits.map(visit => (
                  <Link
                    key={visit.id}
                    to={`/families/${id}/visits/${visit.id}`}
                    className="flex items-start justify-between px-4 py-2.5 hover:bg-hv-page transition-colors group"
                  >
                    <div>
                      <div className="text-sm font-medium text-hv-charcoal group-hover:text-hv-green transition-colors">
                        {formatDateOnly(visit.visitDate)}
                      </div>
                      <div className="text-xs text-hv-sage mt-0.5">
                        {[
                          visit.trainingsReceived.length > 0 && `${visit.trainingsReceived.length} training${visit.trainingsReceived.length !== 1 ? 's' : ''}`,
                          visit.resourcesReceived.length > 0 && `${visit.resourcesReceived.length} resource${visit.resourcesReceived.length !== 1 ? 's' : ''}`,
                        ].filter(Boolean).join(' • ') || 'No resources'}
                      </div>
                      {visit.notes && (
                        <div className="text-xs text-hv-gray mt-0.5 line-clamp-1">{visit.notes}</div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-hv-border group-hover:text-hv-sage transition-colors shrink-0 mt-0.5" />
                  </Link>
                ))}
              </div>
              {visitsQuery.data && visitsQuery.data.total > visits.length && (
                <div className="px-4 py-2.5 border-t border-hv-border">
                  <Link
                    to={`/families/${id}/visits`}
                    className="text-xs text-hv-terracotta hover:underline"
                  >
                    View all {visitsQuery.data.total} visits
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Site map modal ── */}
      {mapSite && mapSite.lat && mapSite.lng && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setMapSite(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-hv-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-hv-charcoal">
                <MapPin size={15} className="text-hv-terracotta" />
                {mapSite.title}
              </div>
              <button
                onClick={() => setMapSite(null)}
                className="text-hv-sage hover:text-hv-charcoal transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ height: 400 }}>
              <MapContainer
                center={[mapSite.lat, mapSite.lng]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                />
                <Marker position={[mapSite.lat, mapSite.lng]}>
                  <Popup>{mapSite.title}</Popup>
                </Marker>
                {mapSite.boundary && mapSite.boundary.length > 0 && (
                  <Polygon
                    positions={mapSite.boundary.map(([lng, lat]) => [lat, lng] as [number, number])}
                    pathOptions={{ color: '#C27D5F', fillColor: '#C27D5F', fillOpacity: 0.15 }}
                  />
                )}
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyDetailPage;
