import { apiClient } from './client';
import { LookupRead, LookupCreate, LookupUpdate, LookupReorder } from '@naru/shared';

/**
 * Valid lookup table names
 */
export type LookupTableName =
  | 'communities'
  | 'sites'
  | 'resources'
  | 'training'
  | 'child-visit-questions'
  | 'parent-visit-questions'
  | 'family-visit-questions';

/**
 * Fetch all entries from a lookup table
 */
export const fetchLookupTable = async (table: LookupTableName): Promise<LookupRead[]> => {
  const response = await apiClient.get<LookupRead[]>(`/admin/${table}`);
  return response.data;
};

/**
 * Create a new entry in a lookup table
 */
export const createLookupEntry = async (
  table: LookupTableName,
  data: LookupCreate
): Promise<LookupRead> => {
  const response = await apiClient.post<LookupRead>(`/admin/${table}`, data);
  return response.data;
};

/**
 * Update an entry in a lookup table
 */
export const updateLookupEntry = async (
  table: LookupTableName,
  id: number,
  data: LookupUpdate
): Promise<LookupRead> => {
  const response = await apiClient.put<LookupRead>(`/admin/${table}/${id}`, data);
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
export const fetchCommunities = () => fetchLookupTable('communities');
export const fetchSites = () => fetchLookupTable('sites');
export const fetchResources = () => fetchLookupTable('resources');
export const fetchTraining = () => fetchLookupTable('training');
export const fetchChildVisitQuestions = () => fetchLookupTable('child-visit-questions');
export const fetchParentVisitQuestions = () => fetchLookupTable('parent-visit-questions');
export const fetchFamilyVisitQuestions = () => fetchLookupTable('family-visit-questions');

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
  fetchChildVisitQuestions,
  fetchParentVisitQuestions,
  fetchFamilyVisitQuestions,
};