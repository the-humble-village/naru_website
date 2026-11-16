import { apiClient } from './client';
import { ChildRead, ChildCreate, ChildUpdate } from '@naru/shared';

export interface ChildListParams {
  familyId?: number;
  motherId?: number;
  communityId?: number;
  siteId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ChildListResponse {
  items: ChildRead[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * List children. Every filter is optional — a child may belong to no family.
 */
export const listChildren = async (params: ChildListParams = {}): Promise<ChildListResponse> => {
  const response = await apiClient.get<ChildListResponse>('/children', { params });
  return response.data;
};

/**
 * Fetch a single child by ID
 */
export const fetchChild = async (childId: number): Promise<ChildRead> => {
  const response = await apiClient.get<ChildRead>(`/children/${childId}`);
  return response.data;
};

/**
 * Create a new child
 */
export const createChild = async (data: ChildCreate): Promise<ChildRead> => {
  const response = await apiClient.post<ChildRead>('/children', data);
  return response.data;
};

/**
 * Update an existing child
 */
export const updateChild = async (childId: number, data: ChildUpdate): Promise<ChildRead> => {
  const response = await apiClient.put<ChildRead>(`/children/${childId}`, data);
  return response.data;
};

/**
 * Delete a child (soft delete)
 */
export const deleteChild = async (childId: number): Promise<void> => {
  await apiClient.delete(`/children/${childId}`);
};

export const childrenApi = {
  listChildren,
  fetchChild,
  createChild,
  updateChild,
  deleteChild,
};
