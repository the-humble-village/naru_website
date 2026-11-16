import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, LookupTableName, type LookupEntry, type LookupEntryUpdate } from '../../api/admin';
import { type TranslationKey } from '@naru/shared';
import { RoleGate } from '../../components/RoleGate';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NameInput } from '../../components/ui/NameInput';
import { ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks';
import { formatDate } from '../../utils/datetime';

interface LookupFormData {
  title: string;
  siteId: string;
  defaultUnit: string;
}

const EMPTY_FORM: LookupFormData = { title: '', siteId: '', defaultUnit: '' };

// Tables whose rows carry a sortOrder and can be reordered by an admin.
const SORTABLE_TABLES = new Set(['examination-types']);

// The one column a table carries beyond `title`. Declared here so the render
// stays generic instead of branching on the table name in a dozen places.
type ExtraKind = 'site' | 'unit';

interface ExtraSpec {
  kind: ExtraKind;
  header: TranslationKey;
  label: TranslationKey;
  hint: TranslationKey;
}

interface TableSpec {
  plural: TranslationKey;
  singular: TranslationKey;
  extra?: ExtraSpec;
}

const TABLE_CONFIG: Record<string, TableSpec> = {
  'communities': {
    plural: 'admin.communities',
    singular: 'admin.community_singular',
    extra: {
      kind: 'site',
      header: 'families.col_site',
      label: 'families.col_site',
      hint: 'admin.community_site_hint',
    },
  },
  'sites': { plural: 'admin.sites', singular: 'admin.site_singular' },
  'resources': {
    plural: 'admin.resources',
    singular: 'admin.resource_singular',
    extra: {
      kind: 'unit',
      header: 'admin.resource_default_unit',
      label: 'admin.resource_default_unit',
      hint: 'admin.resource_default_unit_hint',
    },
  },
  'training': { plural: 'admin.training', singular: 'admin.training_singular' },
  'examination-types': {
    plural: 'admin.examination_types',
    singular: 'admin.examination_type_singular',
  },
};

const DEFAULT_ITEMS: LookupEntry[] = [];

export const AdminLookupsPage: React.FC = () => {
  const { table } = useParams<{ table: string }>();
  const { t } = useTranslation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupEntry | null>(null);
  const [formData, setFormData] = useState<LookupFormData>(EMPTY_FORM);
  const [orderedItems, setOrderedItems] = useState<LookupEntry[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LookupEntry | null>(null);

  const queryClient = useQueryClient();

  // Validate table parameter
  const isValidTable = (table: string): table is LookupTableName => {
    const validTables: LookupTableName[] = [
      'communities',
      'sites',
      'resources',
      'training',
      'examination-types',
    ];
    return validTables.includes(table as LookupTableName);
  };

  const lookupTable = table && isValidTable(table) ? table : null;

  const config = lookupTable
    ? (TABLE_CONFIG[lookupTable] ?? { plural: 'admin.section_lookups' as const, singular: 'common.unnamed' as const })
    : null;

  const extra = config?.extra;
  const isSortableTable = !!lookupTable && SORTABLE_TABLES.has(lookupTable);

  // Community, site, resource and training titles are proper nouns - keyboard autocorrect
  // rewrites real names like "Choc" into dictionary words. Question titles are prose, so
  // they keep autocorrect on.
  const TitleInput = isSortableTable ? 'input' : NameInput;

  // Fetch lookup table data
  const { data: items = DEFAULT_ITEMS, isLoading, error } = useQuery({
    queryKey: ['admin', lookupTable],
    queryFn: () => lookupTable ? adminApi.fetchLookupTable(lookupTable) : Promise.resolve([]),
    enabled: !!lookupTable,
  });

  // Communities name a site, so the form needs the site list to choose from.
  const { data: sites = DEFAULT_ITEMS } = useQuery({
    queryKey: ['admin', 'sites'],
    queryFn: adminApi.fetchSites,
    enabled: extra?.kind === 'site',
  });

  // Keep local ordered list in sync with server data (don't overwrite if user is editing order)
  useEffect(() => {
    if (!orderDirty) setOrderedItems(items);
  }, [items]);

  const extraPayload = (): LookupEntryUpdate => {
    if (!extra) return {};
    if (extra.kind === 'site') {
      return { siteId: formData.siteId === '' ? null : Number(formData.siteId) };
    }
    return { defaultUnit: formData.defaultUnit.trim() === '' ? null : formData.defaultUnit.trim() };
  };

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: (data: LookupEntryUpdate & { title: string }) =>
      lookupTable ? adminApi.createLookupEntry(lookupTable, data) : Promise.reject('Invalid table'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', lookupTable] });
      setShowCreateForm(false);
      resetForm();
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LookupEntryUpdate }) =>
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
    mutationFn: (ordered: LookupEntry[]) => {
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
    setFormData(EMPTY_FORM);
    setShowCreateForm(false);
    setEditingItem(null);
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) return;

    try {
      await createItemMutation.mutateAsync({ title: formData.title.trim(), ...extraPayload() });
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem || !formData.title.trim()) return;

    try {
      await updateItemMutation.mutateAsync({
        id: editingItem.id,
        data: { title: formData.title.trim(), ...extraPayload() }
      });
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const startEdit = (item: LookupEntry) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      siteId: item.siteId == null ? '' : item.siteId.toString(),
      defaultUnit: item.defaultUnit ?? '',
    });
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

  const siteTitle = (siteId: number): string =>
    sites.find((site) => site.id === siteId)?.title ?? `#${siteId}`;

  const renderExtra = (item: LookupEntry): React.ReactNode => {
    if (!extra) return null;
    if (extra.kind === 'site') {
      return item.siteId == null ? (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle size={14} className="shrink-0" />
          {t('admin.community_no_site')}
        </span>
      ) : (
        siteTitle(item.siteId)
      );
    }
    return item.defaultUnit ?? '—';
  };

  const missingSiteCount =
    extra?.kind === 'site' ? items.filter((item) => item.siteId == null).length : 0;

  const header = (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
      <h1 className="text-2xl font-serif font-bold text-hv-charcoal">
        {config ? t(config.plural) : 'Invalid Table'}
      </h1>
      <Link
        to="/admin"
        className="text-hv-terracotta hover:underline transition-colors"
      >
        ← {t('common.back_to_admin')}
      </Link>
    </div>
  );

  // Invalid table parameter
  if (!lookupTable || !config) {
    return (
      <div>
        {header}
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
        {header}
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-hv-gray">{t('admin.loading_entity').replace('{name}', t(config.plural).toLowerCase())}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        {header}
        <div className="bg-white p-6 rounded-xl border border-hv-border">
          <p className="text-red-600">
            {t('admin.failed_load_entity').replace('{name}', t(config.plural).toLowerCase())}: {error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <RoleGate requiredRole="ADMIN">
      <div>
        {header}

        {missingSiteCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 mb-6 text-sm text-amber-900">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">
                {t('admin.communities_missing_site').replace('{count}', missingSiteCount.toString())}
              </p>
              <p>{t('admin.communities_missing_site_hint')}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-hv-border">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-6 border-b border-hv-border">
            <h2 className="text-lg font-serif font-semibold text-hv-charcoal">
              {t(config.plural)} ({items.length})
            </h2>
            <div className="flex items-center gap-3">
              {isSortableTable && (
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
                  {reorderMutation.isPending
                    ? t('common.saving')
                    : orderDirty
                      ? t('common.save_order')
                      : t('common.order_saved')}
                </button>
              )}
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
              >
                {t('admin.add_entity').replace('{name}', t(config.singular))}
              </button>
            </div>
          </div>

          {/* Form */}
          {showCreateForm && (
            <div className="p-6 border-b border-hv-border bg-hv-page">
              <h3 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">
                {editingItem
                  ? t('admin.edit_entity').replace('{name}', t(config.singular))
                  : t('admin.add_new_entity').replace('{name}', t(config.singular))}
              </h3>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div>
                  <label htmlFor="lookup-title" className="block text-sm font-medium text-hv-charcoal mb-1">
                    {t('common.col_title')} <span className="text-red-500">*</span>
                  </label>
                  <TitleInput
                    id="lookup-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    required
                    placeholder={t('admin.enter_entity_title').replace('{name}', t(config.singular).toLowerCase())}
                  />
                </div>

                {extra?.kind === 'site' && (
                  <div>
                    <label htmlFor="lookup-site" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t(extra.label)}
                    </label>
                    <select
                      id="lookup-site"
                      value={formData.siteId}
                      onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                      className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-hv-accent"
                    >
                      <option value="">{t('admin.community_no_site')}</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-hv-sage mt-1">{t(extra.hint)}</p>
                  </div>
                )}

                {extra?.kind === 'unit' && (
                  <div>
                    <label htmlFor="lookup-unit" className="block text-sm font-medium text-hv-charcoal mb-1">
                      {t(extra.label)}
                    </label>
                    <input
                      id="lookup-unit"
                      type="text"
                      value={formData.defaultUnit}
                      onChange={(e) => setFormData({ ...formData, defaultUnit: e.target.value })}
                      maxLength={32}
                      className="w-full max-w-md px-3 py-2 border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent"
                      placeholder={t('admin.resource_default_unit_placeholder')}
                    />
                    <p className="text-xs text-hv-sage mt-1">{t(extra.hint)}</p>
                  </div>
                )}

                <div className="flex justify-start space-x-3">
                  <button
                    type="button"
                    onClick={editingItem ? handleUpdate : handleCreate}
                    disabled={createItemMutation.isPending || updateItemMutation.isPending || !formData.title.trim()}
                    className="px-4 py-2 bg-hv-terracotta text-white rounded-md hover:bg-hv-terracotta-hover disabled:opacity-50 transition-colors"
                  >
                    {createItemMutation.isPending || updateItemMutation.isPending
                      ? t('common.saving')
                      : editingItem
                        ? t('common.update')
                        : t('common.create')}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-hv-gray border border-hv-border rounded-md hover:bg-hv-page transition-colors"
                  >
                    {t('common.cancel')}
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

          {/* Items table (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-hv-page">
                <tr>
                  {isSortableTable && (
                    <th className="px-4 py-3 w-16" />
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_title')}
                  </th>
                  {extra && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                      {t(extra.header)}
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_created')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_updated')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider">
                    {t('common.col_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-hv-border">
                {orderedItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-hv-page">
                    {isSortableTable && (
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
                    {extra && (
                      <td className="px-6 py-4 text-sm text-hv-gray">{renderExtra(item)}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-hv-sage">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-hv-terracotta hover:underline transition-colors"
                      >
                        {t('admin.edit_entity_title')}
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

          {/* Items cards (below md) */}
          <div className="md:hidden divide-y divide-hv-border">
            {orderedItems.map((item, index) => (
              <div key={item.id} className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-hv-charcoal">{item.title}</p>
                    {extra && (
                      <p className="text-sm text-hv-gray mt-1">
                        <span className="text-xs text-hv-sage uppercase tracking-wider mr-2">
                          {t(extra.header)}
                        </span>
                        {renderExtra(item)}
                      </p>
                    )}
                    <p className="text-xs text-hv-sage mt-1">{formatDate(item.updatedAt)}</p>
                  </div>
                  {isSortableTable && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                        aria-label="Move up card"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === orderedItems.length - 1}
                        className="p-1 text-hv-sage hover:text-hv-charcoal disabled:opacity-25 transition-colors"
                        aria-label="Move down card"
                      >
                        <ChevronDown size={20} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-4 text-sm">
                  <button
                    onClick={() => startEdit(item)}
                    className="text-hv-terracotta hover:underline transition-colors"
                  >
                    {t('admin.edit_entity_title')}
                  </button>
                  <button
                    onClick={() => { deleteItemMutation.reset(); setDeleteTarget(item); }}
                    disabled={deleteItemMutation.isPending}
                    className="text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="p-6 text-center text-hv-gray">
              {t('admin.empty_entity').replace('{name}', t(config.plural).toLowerCase())}
            </div>
          )}
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          title={t('admin.delete_entity').replace('{name}', t(config.singular))}
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
          warning={t('admin.delete_warning_entity').replace('{name}', t(config.singular).toLowerCase())}
          busy={deleteItemMutation.isPending}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); deleteItemMutation.reset(); }}
        />
      </div>
    </RoleGate>
  );
};

export default AdminLookupsPage;
