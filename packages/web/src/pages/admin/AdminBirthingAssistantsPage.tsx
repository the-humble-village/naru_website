import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { adminApi } from '../../api/admin';
import axios from 'axios';
import { BirthingAssistantRead, BirthingAssistantCreate, BirthingAssistantUpdate } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

/**
 * Pull the server's message out of an API failure. The backend responds with
 * `{ error: string }` (app.ts onError), so domain messages only live on the body.
 */
const getErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/** Order-insensitive comparison of two association id lists. */
const sameIds = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
};

interface BAFormData {
  name: string;
  communityIds: number[];
  trainingIds: number[];
}

/**
 * AdminBirthingAssistantsPage - Birthing assistants management with multi-select UI
 */
export const AdminBirthingAssistantsPage: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBA, setEditingBA] = useState<BirthingAssistantRead | null>(null);
  const [formData, setFormData] = useState<BAFormData>({
    name: '',
    communityIds: [],
    trainingIds: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BirthingAssistantRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch birthing assistants
  const { data: birthingAssistants = [], isLoading: loadingBAs, error: errorBAs } = useQuery({
    queryKey: ['birthing-assistants'],
    queryFn: birthingAssistantsApi.fetchBirthingAssistants,
  });

  // Fetch communities for multi-select
  const { data: communities = [] } = useQuery({
    queryKey: ['admin', 'communities'],
    queryFn: adminApi.fetchCommunities,
  });

  // Fetch training options for multi-select
  const { data: trainings = [] } = useQuery({
    queryKey: ['admin', 'training'],
    queryFn: adminApi.fetchTraining,
  });

  // Create BA mutation
  const createBAMutation = useMutation({
    mutationFn: birthingAssistantsApi.createBirthingAssistant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthing-assistants'] });
    },
  });

  // Update BA mutation
  const updateBAMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BirthingAssistantUpdate }) =>
      birthingAssistantsApi.updateBirthingAssistant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthing-assistants'] });
    },
  });

  // Delete BA mutation (soft delete)
  const deleteBAMutation = useMutation({
    mutationFn: (id: number) => birthingAssistantsApi.deleteBirthingAssistant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthing-assistants'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      communityIds: [],
      trainingIds: [],
    });
    setShowCreateForm(false);
    setEditingBA(null);
    setFormError(null);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setFormError(null);

    const createData: BirthingAssistantCreate = {
      name: formData.name.trim(),
      communityIds: formData.communityIds,
      trainingIds: formData.trainingIds,
    };

    try {
      await createBAMutation.mutateAsync(createData);
      resetForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to create birthing assistant'));
    }
  };

  const handleUpdate = async () => {
    if (!editingBA || !formData.name.trim()) return;
    setFormError(null);

    // Only send what actually changed. Sending communityIds/trainingIds makes the
    // server drop and recreate every junction row, so skip them when untouched.
    const updateData: BirthingAssistantUpdate = {};
    if (formData.name.trim() !== editingBA.name) {
      updateData.name = formData.name.trim();
    }
    if (!sameIds(formData.communityIds, editingBA.servedCommunities?.map((sc) => sc.id) ?? [])) {
      updateData.communityIds = formData.communityIds;
    }
    if (!sameIds(formData.trainingIds, editingBA.trainingsReceived?.map((tr) => tr.id) ?? [])) {
      updateData.trainingIds = formData.trainingIds;
    }

    if (Object.keys(updateData).length === 0) {
      resetForm();
      return;
    }

    try {
      await updateBAMutation.mutateAsync({ id: editingBA.id, data: updateData });
      resetForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to update birthing assistant'));
    }
  };

  const startEdit = (ba: BirthingAssistantRead) => {
    setFormError(null);
    setEditingBA(ba);
    setFormData({
      name: ba.name,
      communityIds: ba.servedCommunities?.map((sc) => sc.id) ?? [],
      trainingIds: ba.trainingsReceived?.map((tr) => tr.id) ?? [],
    });
    setShowCreateForm(true);
  };

  const requestDelete = (ba: BirthingAssistantRead) => {
    setDeleteError(null);
    setDeleteTarget(ba);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteBAMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      // Keep the dialog open so the server's reason stays visible.
      setDeleteError(getErrorMessage(error, 'Failed to delete birthing assistant'));
    }
  };

  const cancelForm = () => {
    resetForm();
  };

  const handleCommunityToggle = (communityId: number) => {
    setFormData({
      ...formData,
      communityIds: formData.communityIds.includes(communityId)
        ? formData.communityIds.filter(id => id !== communityId)
        : [...formData.communityIds, communityId]
    });
  };

  const handleTrainingToggle = (trainingId: number) => {
    setFormData({
      ...formData,
      trainingIds: formData.trainingIds.includes(trainingId)
        ? formData.trainingIds.filter(id => id !== trainingId)
        : [...formData.trainingIds, trainingId]
    });
  };

  const removeCommunity = (communityId: number) => {
    setFormData((prev) => ({
      ...prev,
      communityIds: prev.communityIds.filter((id) => id !== communityId),
    }));
  };

  const removeTraining = (trainingId: number) => {
    setFormData((prev) => ({
      ...prev,
      trainingIds: prev.trainingIds.filter((id) => id !== trainingId),
    }));
  };

  /**
   * Label a selected association id. A soft-deleted lookup row disappears from
   * the checkbox list but stays on the record, so fall back to the title the
   * record itself carries and finally to the raw id — otherwise the association
   * would be invisible and impossible to remove.
   */
  const communityLabel = (id: number): string =>
    communities.find((c) => c.id === id)?.title
    ?? editingBA?.servedCommunities?.find((sc) => sc.id === id)?.title
    ?? `Community ${id}`;

  const trainingLabel = (id: number): string =>
    trainings.find((t) => t.id === id)?.title
    ?? editingBA?.trainingsReceived?.find((tr) => tr.id === id)?.title
    ?? `Training ${id}`;

  const getCommunityNames = (ba: BirthingAssistantRead) => {
    if (!ba.servedCommunities || ba.servedCommunities.length === 0) return '—';
    return ba.servedCommunities.map((sc) => sc.title).join(', ');
  };

  const getTrainingNames = (ba: BirthingAssistantRead) => {
    if (!ba.trainingsReceived || ba.trainingsReceived.length === 0) return '—';
    return ba.trainingsReceived.map((tr) => tr.title).join(', ');
  };

  // Loading state
  if (loadingBAs) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Birthing Assistants</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-hv-gray">Loading birthing assistants...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (errorBAs) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Birthing Assistants</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-red-600">Failed to load birthing assistants: {errorBAs.message}</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGate requiredRole="SUPERVISOR">
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Birthing Assistants</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-hv-border">
          <div className="flex justify-between items-center p-6 border-b border-hv-border">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal">
              Birthing Assistants ({birthingAssistants.length})
            </h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
            >
              Add Birthing Assistant
            </button>
          </div>

          {/* Form */}
          {showCreateForm && (
            <div className="p-6 border-b border-hv-border bg-hv-page">
              <h3 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
                {editingBA ? 'Edit Birthing Assistant' : 'Add New Birthing Assistant'}
              </h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="ba-name" className="block text-sm font-medium text-hv-charcoal mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ba-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    required
                    placeholder="Enter birthing assistant name"
                  />
                </div>

                {/* Communities Multi-Select */}
                <div>
                  <label className="block text-sm font-medium text-hv-charcoal mb-2">
                    Served Communities
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-hv-border-input rounded-md p-3">
                    {communities.map((community) => (
                      <label key={community.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.communityIds.includes(community.id)}
                          onChange={() => handleCommunityToggle(community.id)}
                          className="rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
                        />
                        <span className="text-sm text-hv-gray">{community.title}</span>
                      </label>
                    ))}
                    {communities.length === 0 && (
                      <p className="text-sm text-hv-gray col-span-full">No communities available</p>
                    )}
                  </div>
                  <p className="text-xs text-hv-gray mt-1">
                    Selected: {formData.communityIds.length} communities
                  </p>
                  {formData.communityIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.communityIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-hv-border bg-hv-page px-3 py-1 text-xs text-hv-charcoal"
                        >
                          {communityLabel(id)}
                          <button
                            type="button"
                            onClick={() => removeCommunity(id)}
                            aria-label={`Remove community ${communityLabel(id)}`}
                            title={`Remove community ${communityLabel(id)}`}
                            className="text-hv-crisis hover:text-red-800 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Training Multi-Select */}
                <div>
                  <label className="block text-sm font-medium text-hv-charcoal mb-2">
                    Trainings Received
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-hv-border-input rounded-md p-3">
                    {trainings.map((training) => (
                      <label key={training.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.trainingIds.includes(training.id)}
                          onChange={() => handleTrainingToggle(training.id)}
                          className="rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
                        />
                        <span className="text-sm text-hv-gray">{training.title}</span>
                      </label>
                    ))}
                    {trainings.length === 0 && (
                      <p className="text-sm text-hv-gray col-span-full">No trainings available</p>
                    )}
                  </div>
                  <p className="text-xs text-hv-gray mt-1">
                    Selected: {formData.trainingIds.length} trainings
                  </p>
                  {formData.trainingIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.trainingIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-hv-border bg-hv-page px-3 py-1 text-xs text-hv-charcoal"
                        >
                          {trainingLabel(id)}
                          <button
                            type="button"
                            onClick={() => removeTraining(id)}
                            aria-label={`Remove training ${trainingLabel(id)}`}
                            title={`Remove training ${trainingLabel(id)}`}
                            className="text-hv-crisis hover:text-red-800 transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-start space-x-3">
                  <button
                    type="button"
                    onClick={editingBA ? handleUpdate : handleCreate}
                    disabled={createBAMutation.isPending || updateBAMutation.isPending || !formData.name.trim()}
                    className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                  >
                    {createBAMutation.isPending || updateBAMutation.isPending
                      ? 'Saving...'
                      : editingBA
                        ? 'Update'
                        : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">
                      Failed to {editingBA ? 'update' : 'create'} birthing assistant: {formError}
                    </p>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Birthing Assistants List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hv-page">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Communities Served
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Trainings Received
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-hv-border">
                {birthingAssistants.map((ba) => (
                  <tr key={ba.id} className="hover:bg-hv-page">
                    <td className="px-6 py-4">
                      <div className="font-medium text-hv-charcoal">
                        {ba.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-hv-gray max-w-xs">
                      <div className="truncate" title={getCommunityNames(ba)}>
                        {getCommunityNames(ba)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-hv-gray max-w-xs">
                      <div className="truncate" title={getTrainingNames(ba)}>
                        {getTrainingNames(ba)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {new Date(ba.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => startEdit(ba)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requestDelete(ba)}
                        disabled={deleteBAMutation.isPending}
                        title={`Delete ${ba.name}`}
                        className="text-hv-crisis hover:underline disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {birthingAssistants.length === 0 && (
            <div className="p-6 text-center text-hv-gray">
              No birthing assistants found. Create your first birthing assistant to get started.
            </div>
          )}
        </div>

        {deleteTarget && (
          <ConfirmDialog
            open
            title="Delete birthing assistant"
            confirmLabel="Delete"
            busy={deleteBAMutation.isPending}
            message={
              <div className="space-y-2">
                <p>
                  Delete <strong>{deleteTarget.name}</strong>? Their community and training
                  associations will be removed with them.
                </p>
                {deleteError && (
                  <p className="text-hv-crisis font-medium">{deleteError}</p>
                )}
              </div>
            }
            warning="Families already assigned to this birthing assistant keep the assignment until they are edited."
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}
      </div>
    </RoleGate>
  );
};

export default AdminBirthingAssistantsPage;
