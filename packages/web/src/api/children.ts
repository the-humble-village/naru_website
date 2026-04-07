import { apiClient } from './client';
import { ChildRead, ChildCreate, ChildUpdate } from '@naru/shared';

/**
 * List children for a family
 */
export const listChildren = async (familyId: number): Promise<ChildRead[]> => {
  const response = await apiClient.get<ChildRead[]>(`/families/${familyId}/children`);
  return response.data;
};

/**
 * Fetch a single child by ID
 */
export const fetchChild = async (familyId: number, childId: number): Promise<ChildRead> => {
  const response = await apiClient.get<ChildRead>(`/families/${familyId}/children/${childId}`);
  return response.data;
};

/**
 * Create a new child
 */
export const createChild = async (familyId: number, data: ChildCreate): Promise<ChildRead> => {
  const response = await apiClient.post<ChildRead>(`/families/${familyId}/children`, data);
  return response.data;
};

/**
 * Update an existing child
 */
export const updateChild = async (familyId: number, childId: number, data: ChildUpdate): Promise<ChildRead> => {
  const response = await apiClient.put<ChildRead>(`/families/${familyId}/children/${childId}`, data);
  return response.data;
};

/**
 * Delete a child (soft delete)
 */
export const deleteChild = async (familyId: number, childId: number): Promise<void> => {
  await apiClient.delete(`/families/${familyId}/children/${childId}`);
};

export const childrenApi = {
  listChildren,
  fetchChild,
  createChild,
  updateChild,
  deleteChild,
};