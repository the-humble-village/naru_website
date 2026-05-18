import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parentsApi } from '../../api/parents';
import { visitsApi } from '../../api/visits';
import { ParentUpdate, ParentRead } from '@naru/shared';
import { PhotoUpload, PhotoGallery } from '../../components';

/**
 * ParentDetailPage - Shows parent details with edit form
 */
export const ParentDetailPage: React.FC = () => {
  const { id: familyId, pid: parentId } = useParams<{ id: string; pid: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ParentUpdate>({});

  const familyIdNum = familyId ? parseInt(familyId, 10) : 0;
  const parentIdNum = parentId ? parseInt(parentId, 10) : 0;

  // Fetch parent data
  const {
    data: parent,
    isLoading,
    error,
  } = useQuery<ParentRead>({
    queryKey: ['parent', familyIdNum, parentIdNum],
    queryFn: () => parentsApi.fetchParent(familyIdNum, parentIdNum),
    enabled: familyIdNum > 0 && parentIdNum > 0,
  });

  // Fetch parent visits
  const { data: parentVisitsData } = useQuery({
    queryKey: ['parentVisits', familyIdNum, parentIdNum],
    queryFn: () => visitsApi.listParentVisits(familyIdNum, parentIdNum),
    enabled: familyIdNum > 0 && parentIdNum > 0,
  });

  // Update parent mutation
  const updateParentMutation = useMutation({
    mutationFn: (data: ParentUpdate) => parentsApi.updateParent(familyIdNum, parentIdNum, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', familyIdNum, parentIdNum] });
      queryClient.invalidateQueries({ queryKey: ['parents', familyIdNum] });
      setIsEditing(false);
      setEditData({});
    },
  });

  const handleEdit = () => {
    if (parent) {
      setEditData({
        name: parent.name || '',
        role: parent.role || '',
        birthDate: parent.birthDate ? parent.birthDate.split('T')[0] : '',
        dateEntered: parent.dateEntered ? parent.dateEntered.split('T')[0] : '',
        reasonEnroll: parent.reasonEnroll || '',
        dueDate: parent.dueDate ? parent.dueDate.split('T')[0] : '',
        notes: parent.notes || '',
        photos: parent.photos ?? [],
      });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSave = () => {
    const dataToSave: ParentUpdate = {};

    // Only include changed fields
    if (editData.name !== undefined && editData.name !== (parent?.name || '')) {
      dataToSave.name = editData.name || null;
    }
    if (editData.role !== undefined && editData.role !== (parent?.role || '')) {
      dataToSave.role = editData.role || null;
    }
    if (editData.birthDate !== undefined) {
      const birthDateFormatted = editData.birthDate ? `${editData.birthDate}T00:00:00.000Z` : null;
      if (birthDateFormatted !== parent?.birthDate) {
        dataToSave.birthDate = birthDateFormatted;
      }
    }
    if (editData.dateEntered !== undefined) {
      const dateEnteredFormatted = editData.dateEntered ? `${editData.dateEntered}T00:00:00.000Z` : null;
      if (dateEnteredFormatted !== parent?.dateEntered) {
        dataToSave.dateEntered = dateEnteredFormatted;
      }
    }
    if (editData.dueDate !== undefined) {
      const dueDateFormatted = editData.dueDate ? `${editData.dueDate}T00:00:00.000Z` : null;
      if (dueDateFormatted !== parent?.dueDate) {
        dataToSave.dueDate = dueDateFormatted;
      }
    }
    if (editData.reasonEnroll !== undefined && editData.reasonEnroll !== (parent?.reasonEnroll || '')) {
      dataToSave.reasonEnroll = editData.reasonEnroll || null;
    }
    if (editData.notes !== undefined && editData.notes !== (parent?.notes || '')) {
      dataToSave.notes = editData.notes || null;
    }
    if (editData.photos !== undefined) {
      const currentPhotos = parent?.photos ?? [];
      if (JSON.stringify(editData.photos) !== JSON.stringify(currentPhotos)) {
        dataToSave.photos = editData.photos;
      }
    }

    updateParentMutation.mutate(dataToSave);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString();
  };

  const formatRole = (role: string | null) => {
    if (!role) return '—';
    // Capitalize first letter
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (!familyIdNum || !parentIdNum) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis font-medium">Invalid family or parent ID provided.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-hv-gray">Loading parent details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-hv-crisis font-medium">
          {error instanceof Error ? error.message : 'Failed to load parent details'}
        </p>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="bg-hv-page border border-hv-border rounded-xl p-4">
        <p className="text-hv-charcoal font-medium">Parent not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">
          {parent.name || 'Unnamed Parent'}
        </h1>
        <Link
          to={`/families/${familyId}`}
          className="text-hv-terracotta hover:underline transition-colors"
        >
          ← Back to Family
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-hv-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-serif font-semibold text-hv-charcoal">Parent Information</h2>
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="bg-hv-green text-white px-4 py-2 rounded text-sm hover:bg-hv-green-hover transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-hv-charcoal mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Enter parent name"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-hv-charcoal mb-1">
                Role
              </label>
              <input
                type="text"
                id="role"
                value={editData.role || ''}
                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="e.g., mother, father, caregiver"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Birth Date
                </label>
                <input
                  type="date"
                  id="birthDate"
                  value={editData.birthDate || ''}
                  onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                  className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                />
              </div>

              <div>
                <label htmlFor="dateEntered" className="block text-sm font-medium text-hv-charcoal mb-1">
                  Date Entered Program
                </label>
                <input
                  type="date"
                  id="dateEntered"
                  value={editData.dateEntered || ''}
                  onChange={(e) => setEditData({ ...editData, dateEntered: e.target.value })}
                  className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                />
              </div>
            </div>

            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-hv-charcoal mb-1">
                Due Date (if pregnant)
              </label>
              <input
                type="date"
                id="dueDate"
                value={editData.dueDate || ''}
                onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
              />
            </div>

            <div>
              <label htmlFor="reasonEnroll" className="block text-sm font-medium text-hv-charcoal mb-1">
                Reason for Enrollment
              </label>
              <textarea
                id="reasonEnroll"
                rows={3}
                value={editData.reasonEnroll || ''}
                onChange={(e) => setEditData({ ...editData, reasonEnroll: e.target.value })}
                className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Enter reason for enrollment"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-hv-charcoal mb-1">
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                value={editData.notes || ''}
                onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                className="w-full p-2 border border-hv-border-input rounded focus:outline-none focus:ring-2 focus:ring-hv-terracotta"
                placeholder="Enter any additional notes"
              />
            </div>

            <PhotoUpload
              photos={(editData.photos as number[]) ?? []}
              onChange={(photos) => setEditData({ ...editData, photos })}
            />

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                disabled={updateParentMutation.isPending}
                className="bg-hv-terracotta text-white px-4 py-2 rounded text-sm hover:bg-hv-terracotta-hover transition-colors disabled:opacity-50"
              >
                {updateParentMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateParentMutation.isPending}
                className="px-4 py-2 border border-hv-border rounded text-sm text-hv-charcoal hover:bg-hv-page transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {updateParentMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-hv-crisis text-sm">
                  Error saving parent: {updateParentMutation.error instanceof Error ? updateParentMutation.error.message : 'Unknown error'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-hv-charcoal">Name</label>
              <p className="text-hv-charcoal">{parent.name || '—'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-hv-charcoal">Role</label>
              <p className="text-hv-charcoal">{formatRole(parent.role)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-hv-charcoal">Birth Date</label>
                <p className="text-hv-charcoal">{formatDate(parent.birthDate)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-hv-charcoal">Date Entered Program</label>
                <p className="text-hv-charcoal">{formatDate(parent.dateEntered)}</p>
              </div>
            </div>

            {parent.dueDate && (
              <div>
                <label className="text-sm font-medium text-hv-charcoal">Due Date</label>
                <p className="text-hv-charcoal">{formatDate(parent.dueDate)}</p>
              </div>
            )}

            {parent.reasonEnroll && (
              <div>
                <label className="text-sm font-medium text-hv-charcoal">Reason for Enrollment</label>
                <p className="text-hv-charcoal text-sm whitespace-pre-wrap">{parent.reasonEnroll}</p>
              </div>
            )}

            {parent.notes && (
              <div>
                <label className="text-sm font-medium text-hv-charcoal">Notes</label>
                <p className="text-hv-charcoal text-sm whitespace-pre-wrap">{parent.notes}</p>
              </div>
            )}

            {parent.photos && parent.photos.length > 0 && (
              <PhotoGallery photos={parent.photos} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-hv-border">
              <div>
                <label className="text-sm font-medium text-hv-charcoal">Created</label>
                <p className="text-hv-sage text-sm">{formatDate(parent.createdAt)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-hv-charcoal">Last Updated</label>
                <p className="text-hv-sage text-sm">{formatDate(parent.updatedAt)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Parent Visits Section */}
      <div className="bg-white p-6 rounded-xl border border-hv-border mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-serif font-semibold text-hv-charcoal">Parent Visits</h2>
          <Link
            to={`/families/${familyId}/parents/${parentId}/visits/new`}
            className="bg-hv-terracotta text-white px-4 py-2 rounded text-sm hover:bg-hv-terracotta-hover transition-colors"
          >
            Add Visit
          </Link>
        </div>

        {parentVisitsData && parentVisitsData.visits && parentVisitsData.visits.length > 0 ? (
          <div className="divide-y divide-hv-border">
            {parentVisitsData.visits.map((visit) => (
              <Link
                key={visit.id}
                to={`/families/${familyId}/parents/${parentId}/visits/${visit.id}`}
                className="flex items-center justify-between py-3 hover:bg-hv-page px-2 -mx-2 rounded transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-hv-charcoal">
                    {new Date(visit.visitDate).toLocaleDateString()}
                  </span>
                  {visit.weight > 0 && (
                    <span className="text-sm text-hv-sage ml-3">
                      {visit.weight} kg
                    </span>
                  )}
                </div>
                <span className="text-hv-sage text-sm">&rarr;</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-hv-sage">No visits recorded yet.</p>
        )}
      </div>
    </div>
  );
};

export default ParentDetailPage;
