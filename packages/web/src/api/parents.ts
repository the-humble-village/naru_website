import { apiClient } from './client';
import { ParentRead, ParentCreate, ParentUpdate } from '@naru/shared';

/**
 * List parents for a family
 */
export const listParents = async (familyId: number): Promise<ParentRead[]> => {
  const response = await apiClient.get<ParentRead[]>(`/families/${familyId}/parents`);
  return response.data;
};

/**
 * Fetch a single parent by ID
 */
export const fetchParent = async (familyId: number, parentId: number): Promise<ParentRead> => {
  const response = await apiClient.get<ParentRead>(`/families/${familyId}/parents/${parentId}`);
  return response.data;
};

/**
 * Create a new parent
 */
export const createParent = async (familyId: number, data: ParentCreate): Promise<ParentRead> => {
  const response = await apiClient.post<ParentRead>(`/families/${familyId}/parents`, data);
  return response.data;
};

/**
 * Update an existing parent
 */
export const updateParent = async (familyId: number, parentId: number, data: ParentUpdate): Promise<ParentRead> => {
  const response = await apiClient.put<ParentRead>(`/families/${familyId}/parents/${parentId}`, data);
  return response.data;
};

/**
 * Delete a parent (soft delete)
 */
export const deleteParent = async (familyId: number, parentId: number): Promise<void> => {
  await apiClient.delete(`/families/${familyId}/parents/${parentId}`);
};

export const parentsApi = {
  listParents,
  fetchParent,
  createParent,
  updateParent,
  deleteParent,
};