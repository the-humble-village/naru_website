import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, LookupTableName } from '../../api/admin';
import { LookupRead, LookupCreate, LookupUpdate } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface LookupFormData {
  title: string;
}

const QUESTION_TABLES = new Set(['child-visit-questions', 'parent-visit-questions', 'family-visit-questions']);

const TABLE_CONFIG: Record<string, { plural: string; singular: string }> = {
  'communities':           { plural: 'Communities',            singular: 'Community' },
  'sites':                 { plural: 'Sites',                  singular: 'Site' },
  'resources':             { plural: 'Resources',              singular: 'Resource' },
  'training':              { plural: 'Training',               singular: 'Training' },
  'child-visit-questions': { plural: 'Child Visit Questions',  singular: 'Child Visit Question' },
  'parent-visit-questions':{ plural: 'Parent Visit Questions', singular: 'Parent Visit Question' },
  'family-visit-questions':{ plural: 'Family Visit Questions', singular: 'Family Visit Question' },
};

const DEFAULT_ITEMS: LookupRead[] = [];

export const AdminLookupsPage: React.FC = () => {
  const { table } = useParams<{ table: string }>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupRead | null>(null);
  const [formData, setFormData] = useState<LookupFormData>({ title: '' });
  const [orderedItems, setOrderedItems] = useState<LookupRead[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LookupRead | null>(null);

  const queryClient = useQueryClient();

  // Validate table parameter
  const isValidTable = (table: string): table is LookupTableName => {
    const validTables: LookupTableName[] = [
      'communities',
      'sites',
      'resources',
      'training',
      'child-visit-questions',
      'parent-visit-questions',
      'family-visit-questions',
    ];
    return validTables.includes(table as LookupTableName);
  };

  const lookupTable = table && isValidTable(table) ? table : null;

  const config = lookupTable ? (TABLE_CONFIG[lookupTable] ?? { plural: 'Lookup Table', singular: 'Item' }) : null;

  const isQuestionTable = !!lookupTable && QUESTION_TABLES.has(lookupTable);

  // Fetch lookup table data
  const { data: items = DEFAULT_ITEMS, isLoading, error } = useQuery({
    queryKey: ['admin', lookupTable],
    queryFn: () => lookupTable ? adminApi.fetchLookupTable(lookupTable) : Promise.resolve([]),
    enabled: !!lookupTable,
  });

  // Keep local ordered list in sync with server data (don't overwrite if user is editing order)
  useEffect(() => {
    if (!orderDirty) setOrderedItems(items);
  }, [items]);

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: (data: LookupCreate) =>
      lookupTable ? adminApi.createLookupEntry(lookupTable, data) : Promise.reject('Invalid table'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', lookupTable] });
      setShowCreateForm(false);
      resetForm();
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LookupUpdate }) =>
      lookupTable ? adminApi.updateLookupEntry(lookupTable, id, data) : Promise.reject('Invalid table'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', lookupTable] });
      setEditingItem(null);
      resetForm();
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (id: number) =>
      lookupTable ? adminApi.deleteLookupEntry(lookupTable, id) : Promise.reject('Invalid table'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', lookupTable] });
      setDeleteTarget(null);
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (ordered: LookupRead[]) => {
      if (!lookupTable) return Promise.reject('Invalid table');
      return adminApi.reorderLookupEntries(
        lookupTable,
        ordered.map((item, idx) => ({ id: item.id, sortOrder: idx }))
      );
    },
    onSuccess: () => {
      setOrderDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin', lookupTable] });
    },
  });

  const resetForm = () => {
    setFormData({ title: '' });
    setShowCreateForm(false);
    setEditingItem(null);
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;

    try {
      await createItemMutation.mutateAsync({ title: formData.title.trim() });
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem || !formData.title.trim()) return;

    try {
      await updateItemMutation.mutateAsync({
        id: editingItem.id,
        data: { title: formData.title.trim() }
      });
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const startEdit = (item: LookupRead) => {
    setEditingItem(item);
    setFormData({ title: item.title });
    setShowCreateForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteItemMutation.mutateAsync(deleteTarget.id);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const next = [...orderedItems];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    const current = next[index];
    const other = next[swapWith];
    if (!current || !other) return;
    next[index] = other;
    next[swapWith] = current;
    setOrderedItems(next);
    setOrderDirty(true);
  };

  // Invalid table parameter
  if (!lookupTable) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">Invalid Table</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-red-600">Invalid lookup table: {table}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{config!.plural}</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-hv-gray">Loading {config!.plural.toLowerCase()}...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{config!.plural}</h1>
          <Link
            to="/admin"
            className="text-hv-terracotta hover:underline transition-colors"
          >
            ← Back to Admin
          </Link>
        </div>
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-red-600">Failed to load {config!.plural.toLowerCase()}: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <RoleGate requiredRole="ADMIN">
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
          <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{config!.plural}</h1>
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
              {config!.plural} ({items.length})
            </h2>
            <div className="flex items-center gap-3">
              {isQuestionTable && (
                <button
                  onClick={() => reorderMutation.mutate(orderedItems)}
                  disabled={reorderMutation.isPending || !orderDirty}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-colors disabled:opacity-50 ${
                    orderDirty
                      ? 'bg-hv-green text-white hover:bg-hv-green-hover'
                      : 'bg-hv-page text-hv-sage border border-hv-border cursor-default'
                  }`}
                >
                  {orderDirty && <span className="w-2 h-2 rounded-full bg-hv-terracotta shrink-0" />}
                  {reorderMutation.isPending ? 'Saving...' : orderDirty ? 'Save Order' : 'Order saved'}
                </button>
              )}
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                Add {config!.singular}
              </button>
            </div>
          </div>

          {/* Form */}
          {showCreateForm && (
            <div className="p-6 border-b border-hv-border bg-hv-page">
              <h3 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
                {editingItem ? `Edit ${config!.singular}` : `Add New ${config!.singular}`}
              </h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div>
                  <label htmlFor="lookup-title" className="block text-sm font-medium text-hv-charcoal mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lookup-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ title: e.target.value })}
                    className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    required
                    placeholder={`Enter ${config!.singular.toLowerCase()} title`}
                  />
                </div>
                <div className="flex justify-start space-x-3">
                  <button
                    type="button"
                    onClick={editingItem ? handleUpdate : handleCreate}
                    disabled={createItemMutation.isPending || updateItemMutation.isPending || !formData.title.trim()}
                    className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                  >
                    {createItemMutation.isPending || updateItemMutation.isPending
                      ? 'Saving...'
                      : editingItem
                        ? 'Update'
                        : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                {(createItemMutation.error || updateItemMutation.error) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-hv-crisis text-sm">
                      Failed to {editingItem ? 'update' : 'create'} item: {(createItemMutation.error || updateItemMutation.error)?.message}
                    </p>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Items List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hv-page">
                <tr>
                  {isQuestionTable && (
                    <th className="px-4 py-3 w-16" />
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-hv-border">
                {orderedItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-hv-page">
                    {isQuestionTable && (
                      <td className="px-4 py-2 w-16">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                            aria-label="Move up"
                          >
                            <ChevronUp size={20} />
                          </button>
                          <button
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === orderedItems.length - 1}
                            className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                            aria-label="Move down"
                          >
                            <ChevronDown size={20} />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="font-medium text-hv-charcoal">{item.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { deleteItemMutation.reset(); setDeleteTarget(item); }}
                        disabled={deleteItemMutation.isPending}
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

          {items.length === 0 && (
            <div className="p-6 text-center text-hv-gray">
              No {config!.plural.toLowerCase()} found. Create your first item to get started.
            </div>
          )}
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Delete ${config!.singular}`}
          message={
            <>
              <p>
                Delete <span className="font-medium text-hv-charcoal">&ldquo;{deleteTarget?.title}&rdquo;</span>? It
                will no longer be selectable when creating or editing records.
              </p>
              {deleteItemMutation.error && (
                <p className="mt-2 text-hv-crisis">
                  Failed to delete item: {deleteItemMutation.error.message}
                </p>
              )}
            </>
          }
          warning={`Existing records that already reference this ${config!.singular.toLowerCase()} keep their current value — they are not changed or removed.`}
          busy={deleteItemMutation.isPending}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); deleteItemMutation.reset(); }}
        />
      </div>
    </RoleGate>
  );
};

export default AdminLookupsPage;
