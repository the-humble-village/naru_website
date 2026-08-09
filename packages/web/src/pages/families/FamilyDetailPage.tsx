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
import { sitesApi } from '../../api/sites';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { FamilyUpdate, SiteRead } from '@naru/shared';
import { PhotoUpload, PhotoGallery, ConfirmDialog, RoleGate, NameInput } from '../../components';
import { usePendingPhotoDeletions, useTranslation } from '../../hooks';
import { AlertTriangle, Users, Baby, CalendarCheck, Pencil, Trash2, Plus, ChevronRight, UserRound, PersonStanding, Heart, MapPin, X } from 'lucide-react';
import { formatDate, formatDateUTC } from '../../utils/datetime';

// Fix Leaflet default marker icons broken by bundlers
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
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
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<FamilyUpdate>({});
  const [mapSite, setMapSite] = useState<SiteRead | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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

  // /sites (not /admin/sites) is used here because only that endpoint returns the
  // lat/lng/boundary columns the map preview needs.
  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const birthingAssistantsQuery = useQuery({
    queryKey: ['birthingAssistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
  });

  // Photo removals are staged until save so Cancel can undo them.
  const photoDeletions = usePendingPhotoDeletions();

  const updateFamilyMutation = useMutation({
    mutationFn: (data: FamilyUpdate) => familiesApi.updateFamily(familyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setIsEditing(false);
      setEditData({});
      // The record saved without these photos, so it is now safe to delete the
      // files. Staged until here so cancelling the edit could undo the removal.
      void photoDeletions.commit();
    },
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: () => familiesApi.deleteFamily(familyId),
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['families'] });
      queryClient.removeQueries({ queryKey: ['family', familyId] });
      navigate('/');
    },
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

  // A soft-deleted lookup row is filtered out of its list endpoint but the FK on the
  // family still points at it, so fall back to a visible placeholder instead of "None".
  const missingLabel = (id: number) => `Unavailable (#${id})`;
  const lookupLabel = (id: number | null, title: string | undefined) =>
    id === null ? null : title ?? missingLabel(id);

  const communityName = lookupLabel(
    family.communityId,
    communities.find(c => c.id === family.communityId)?.title
  );
  const site = sites.find(s => s.id === family.siteId) ?? null;
  const siteName = lookupLabel(family.siteId, site?.title);
  const baName = lookupLabel(
    family.birthingAssistantId,
    birthingAssistants.find(ba => ba.id === family.birthingAssistantId)?.name
  );

  const handleEdit = () => {
    setIsEditing(true);
    // Every mutable FamilyRead column is represented here except localId, which must
    // never be surfaced in an edit form (it drives sync duplicate detection).
    setEditData({
      familyName: family.familyName ?? '',
      childrenEditable: family.childrenEditable,
      inCrisis: family.inCrisis,
      notes: family.notes ?? '',
      communityId: family.communityId,
      siteId: family.siteId,
      birthingAssistantId: family.birthingAssistantId,
      photos: family.photos ?? [],
    });
  };

  const handleCancel = () => {
    photoDeletions.discard();
    setIsEditing(false);
    setEditData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Only send changed fields.
    const dataToSave: FamilyUpdate = {};

    if (editData.familyName !== undefined && editData.familyName !== (family.familyName ?? '')) {
      dataToSave.familyName = editData.familyName || null;
    }
    if (editData.notes !== undefined && editData.notes !== (family.notes ?? '')) {
      dataToSave.notes = editData.notes || null;
    }
    if (editData.childrenEditable !== undefined && editData.childrenEditable !== family.childrenEditable) {
      dataToSave.childrenEditable = editData.childrenEditable;
    }
    if (editData.inCrisis !== undefined && editData.inCrisis !== family.inCrisis) {
      dataToSave.inCrisis = editData.inCrisis;
    }
    if (editData.communityId !== undefined && (editData.communityId ?? null) !== family.communityId) {
      dataToSave.communityId = editData.communityId ?? null;
    }
    if (editData.siteId !== undefined && (editData.siteId ?? null) !== family.siteId) {
      dataToSave.siteId = editData.siteId ?? null;
    }
    if (editData.birthingAssistantId !== undefined && (editData.birthingAssistantId ?? null) !== family.birthingAssistantId) {
      dataToSave.birthingAssistantId = editData.birthingAssistantId ?? null;
    }
    if (editData.photos !== undefined && JSON.stringify(editData.photos) !== JSON.stringify(family.photos ?? [])) {
      dataToSave.photos = editData.photos;
    }

    updateFamilyMutation.mutate(dataToSave);
  };

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const totalVisits = visitsQuery.data?.total ?? visits.length;

  // The backend cascades the delete to every parent, child and visit belonging to
  // this family, so spell that out rather than a vague "cannot be undone".
  const deleteMessage =
    `Delete ${family.familyName || 'this family'}? This also removes ` +
    `${plural(parents.length, 'parent', 'parents')}, ` +
    `${plural(children.length, 'child', 'children')} and their visits ` +
    `(${plural(totalVisits, 'family visit', 'family visits')}). This cannot be undone.`;

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
                {t('families.col_crisis')}
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
              {t('admin.edit_entity_title')}
            </button>
          )}
          <RoleGate requiredRole="SUPERVISOR">
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleteFamilyMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-200 rounded-md text-hv-crisis hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </RoleGate>
        </div>
      </div>

      {isEditing ? (
        /* ── Edit form ── */
        <div className="bg-white p-5 rounded-xl border border-hv-border mb-5">
          <h2 className="text-sm font-semibold text-hv-charcoal mb-4">Edit Family</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="familyName" className="block text-xs font-medium text-hv-charcoal mb-1">{t('families.col_name')}</label>
                <NameInput
                  id="familyName"
                  value={editData.familyName || ''}
                  onChange={(e) => setEditData({ ...editData, familyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                />
              </div>
              <div>
                <label htmlFor="communityId" className="block text-xs font-medium text-hv-charcoal mb-1">{t('families.col_community')}</label>
                <select
                  id="communityId"
                  value={editData.communityId || ''}
                  onChange={(e) => setEditData({ ...editData, communityId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">{t('family.none')}</option>
                  {editData.communityId != null && !communities.some(c => c.id === editData.communityId) && (
                    <option value={editData.communityId}>{missingLabel(editData.communityId)}</option>
                  )}
                  {communities.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="siteId" className="block text-xs font-medium text-hv-charcoal mb-1">{t('families.col_site')}</label>
                <select
                  id="siteId"
                  value={editData.siteId || ''}
                  onChange={(e) => setEditData({ ...editData, siteId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">{t('family.none')}</option>
                  {editData.siteId != null && !sites.some(s => s.id === editData.siteId) && (
                    <option value={editData.siteId}>{missingLabel(editData.siteId)}</option>
                  )}
                  {sites.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="birthingAssistantId" className="block text-xs font-medium text-hv-charcoal mb-1">{t('families.col_assistant')}</label>
                <select
                  id="birthingAssistantId"
                  value={editData.birthingAssistantId || ''}
                  onChange={(e) => setEditData({ ...editData, birthingAssistantId: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                >
                  <option value="">{t('family.none')}</option>
                  {editData.birthingAssistantId != null && !birthingAssistants.some(ba => ba.id === editData.birthingAssistantId) && (
                    <option value={editData.birthingAssistantId}>{missingLabel(editData.birthingAssistantId)}</option>
                  )}
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
              <label htmlFor="notes" className="block text-xs font-medium text-hv-charcoal mb-1">Notes</label>
              <textarea
                id="notes"
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
                pendingDeletions={photoDeletions}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateFamilyMutation.isPending}
                className="px-4 py-2 text-sm bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateFamilyMutation.isPending ? t('common.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
            {updateFamilyMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-hv-crisis text-sm">
                  Error saving family: {updateFamilyMutation.error instanceof Error ? updateFamilyMutation.error.message : 'Unknown error'}
                </p>
              </div>
            )}
          </form>
        </div>
      ) : (
        /* ── Info strip ── */
        <div className="bg-white rounded-xl border border-hv-border mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-hv-border">
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">{t('families.col_community')}</div>
              <div className="text-sm font-medium text-hv-charcoal">{communityName || <span className="text-hv-sage italic">{t('family.none')}</span>}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">{t('families.col_site')}</div>
              {site?.lat && site?.lng ? (
                <button
                  onClick={() => setMapSite(site)}
                  className="flex items-center gap-1 text-sm font-medium text-hv-terracotta hover:underline"
                >
                  <MapPin size={13} />
                  {siteName}
                </button>
              ) : (
                <div className="text-sm font-medium text-hv-charcoal">{siteName || <span className="text-hv-sage italic">{t('family.none')}</span>}</div>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">{t('families.col_assistant')}</div>
              <div className="text-sm font-medium text-hv-charcoal">{baName || <span className="text-hv-sage italic">{t('family.none')}</span>}</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-hv-sage uppercase tracking-wide mb-0.5">Updated</div>
              <div className="text-sm font-medium text-hv-charcoal">{formatDate(family.updatedAt)}</div>
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
                {t('family.parents')}
                {parents.length > 0 && (
                  <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">{parents.length}</span>
                )}
              </h2>
              <Link
                to={`/families/${id}/parents/new`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                <Plus size={12} />
                {t('family.add_parent')}
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
                        <span>{formatDateUTC(parent.birthDate)} · {ageLabel(parent.birthDate)}</span>
                      )}
                      {parent.dueDate && (
                        <span className="text-hv-terracotta">Due {formatDateUTC(parent.dueDate)}</span>
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
                {t('family.children')}
                {children.length > 0 && (
                  <span className="ml-1 bg-hv-page text-hv-sage text-xs px-1.5 py-0.5 rounded-full">{children.length}</span>
                )}
              </h2>
              <Link
                to={`/families/${id}/children/new`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                <Plus size={12} />
                {t('family.add_child')}
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
                        {child.sex} • {ageLabel(child.birthDate)} • {formatDateUTC(child.birthDate)}
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
              {t('dash.recent_visits')}
            </h2>
            <Link
              to={`/families/${id}/visits/new`}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              <Plus size={12} />
              {t('common.add_visit')}
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
                        {formatDateUTC(visit.visitDate)}
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

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete family"
        message={deleteMessage}
        warning={
          deleteFamilyMutation.isError
            ? 'Failed to delete this family. Please try again.'
            : undefined
        }
        busy={deleteFamilyMutation.isPending}
        onConfirm={() => deleteFamilyMutation.mutate()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

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
