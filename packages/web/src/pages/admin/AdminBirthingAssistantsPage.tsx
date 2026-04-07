import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { birthingAssistantsApi } from '../../api/birthing-assistants';
import { adminApi } from '../../api/admin';
import { BirthingAssistantRead, BirthingAssistantCreate, BirthingAssistantUpdate } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';

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
      setShowCreateForm(false);
      resetForm();
    },
  });

  // Update BA mutation
  const updateBAMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BirthingAssistantUpdate }) =>
      birthingAssistantsApi.updateBirthingAssistant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['birthing-assistants'] });
      setEditingBA(null);
      resetForm();
    },
  });

  // Delete BA mutation
  const deleteBAMutation = useMutation({
    mutationFn: birthingAssistantsApi.deleteBirthingAssistant,
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
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    const createData: BirthingAssistantCreate = {
      name: formData.name.trim(),
      communityIds: formData.communityIds,
      trainingIds: formData.trainingIds,
    };

    try {
      await createBAMutation.mutateAsync(createData);
    } catch (error) {
      console.error('Failed to create birthing assistant:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingBA || !formData.name.trim()) return;

    const updateData: BirthingAssistantUpdate = {
      name: formData.name.trim(),
      communityIds: formData.communityIds,
      trainingIds: formData.trainingIds,
    };

    try {
      await updateBAMutation.mutateAsync({ id: editingBA.id, data: updateData });
    } catch (error) {
      console.error('Failed to update birthing assistant:', error);
    }
  };

  const startEdit = (ba: BirthingAssistantRead) => {
    setEditingBA(ba);
    setFormData({
      name: ba.name,
      communityIds: ba.servedCommunities?.map(sc => sc.communityId) || [],
      trainingIds: ba.trainingsReceived?.map(tr => tr.trainingId) || [],
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (ba: BirthingAssistantRead) => {
    if (!confirm(`Are you sure you want to delete "${ba.name}"?`)) return;

    try {
      await deleteBAMutation.mutateAsync(ba.id);
    } catch (error) {
      console.error('Failed to delete birthing assistant:', error);
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

  const getCommunityNames = (ba: BirthingAssistantRead) => {
    if (!ba.servedCommunities || ba.servedCommunities.length === 0) return '—';
    return ba.servedCommunities
      .map(sc => sc.community?.title || `Community ${sc.communityId}`)
      .join(', ');
  };

  const getTrainingNames = (ba: BirthingAssistantRead) => {
    if (!ba.trainingsReceived || ba.trainingsReceived.length === 0) return '—';
    return ba.trainingsReceived
      .map(tr => tr.training?.title || `Training ${tr.trainingId}`)
      .join(', ');
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
                {(createBAMutation.error || updateBAMutation.error) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">
                      Failed to {editingBA ? 'update' : 'create'} birthing assistant: {(createBAMutation.error || updateBAMutation.error)?.message}
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
                        onClick={() => handleDelete(ba)}
                        disabled={deleteBAMutation.isPending}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
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
      </div>
    </RoleGate>
  );
};

export default AdminBirthingAssistantsPage;
