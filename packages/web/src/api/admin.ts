import { apiClient } from './client';
import { LookupRead, LookupCreate, LookupUpdate, LookupReorder, CommunityRead, ResourceRead } from '@naru/shared';

/**
 * Valid lookup table names
 */
export type LookupTableName =
  | 'communities'
  | 'sites'
  | 'resources'
  | 'training'
  | 'examination-types';

/**
 * A lookup row plus the extra columns a few tables carry: communities name a
 * site, resources name a default unit. Every other table ignores them.
 */
export type LookupEntry = LookupRead & {
  siteId?: number | null;
  defaultUnit?: string | null;
};

export type LookupEntryCreate = LookupCreate & {
  siteId?: number | null;
  defaultUnit?: string | null;
};

export type LookupEntryUpdate = LookupUpdate & {
  siteId?: number | null;
  defaultUnit?: string | null;
};

/**
 * Fetch all entries from a lookup table
 */
export const fetchLookupTable = async (table: LookupTableName): Promise<LookupEntry[]> => {
  const response = await apiClient.get<LookupEntry[]>(`/admin/${table}`);
  return response.data;
};

/**
 * Create a new entry in a lookup table
 */
export const createLookupEntry = async (
  table: LookupTableName,
  data: LookupEntryCreate
): Promise<LookupEntry> => {
  const response = await apiClient.post<LookupEntry>(`/admin/${table}`, data);
  return response.data;
};

/**
 * Update an entry in a lookup table
 */
export const updateLookupEntry = async (
  table: LookupTableName,
  id: number,
  data: LookupEntryUpdate
): Promise<LookupEntry> => {
  const response = await apiClient.put<LookupEntry>(`/admin/${table}/${id}`, data);
  return response.data;
};

/**
 * Delete an entry from a lookup table (soft delete)
 */
export const deleteLookupEntry = async (table: LookupTableName, id: number): Promise<void> => {
  await apiClient.delete(`/admin/${table}/${id}`);
};

/**
 * Reorder question entries
 */
export const reorderLookupEntries = async (
  table: LookupTableName,
  items: LookupReorder
): Promise<void> => {
  await apiClient.put(`/admin/${table}/reorder`, items);
};

/**
 * Convenience functions for specific lookup tables
 */
// Communities carry siteId and resources carry defaultUnit, so both are read
// back as their specific type rather than the generic lookup row.
export const fetchCommunities = async (): Promise<CommunityRead[]> => {
  const response = await apiClient.get<CommunityRead[]>('/admin/communities');
  return response.data;
};
export const fetchSites = () => fetchLookupTable('sites');
export const fetchResources = async (): Promise<ResourceRead[]> => {
  const response = await apiClient.get<ResourceRead[]>('/admin/resources');
  return response.data;
};
export const fetchTraining = () => fetchLookupTable('training');
export const fetchExaminationTypes = () => fetchLookupTable('examination-types');

export const adminApi = {
  fetchLookupTable,
  createLookupEntry,
  updateLookupEntry,
  deleteLookupEntry,
  reorderLookupEntries,
  fetchCommunities,
  fetchSites,
  fetchResources,
  fetchTraining,
  fetchExaminationTypes,
};