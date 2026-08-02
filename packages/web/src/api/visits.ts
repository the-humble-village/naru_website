import { apiClient } from './client';
import { FamilyVisitRead, FamilyVisitCreate, FamilyVisitUpdate, ChildVisitRead, ChildVisitCreate, ChildVisitUpdate, ParentVisitRead, ParentVisitCreate, ParentVisitUpdate } from '@naru/shared';

/**
 * Family Visit API functions
 */
export interface ListVisitsParams {
  skip?: number;
  limit?: number;
}

export interface ListVisitsResponse<T> {
  visits: T[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * List family visits
 */
export const listFamilyVisits = async (familyId: number, params: ListVisitsParams = {}): Promise<ListVisitsResponse<FamilyVisitRead>> => {
  const searchParams = new URLSearchParams();
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/families/${familyId}/visits${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListVisitsResponse<FamilyVisitRead>>(url);
  return response.data;
};

/**
 * Fetch a single family visit by ID
 */
export const fetchFamilyVisit = async (familyId: number, visitId: number): Promise<FamilyVisitRead> => {
  const response = await apiClient.get<FamilyVisitRead>(`/families/${familyId}/visits/${visitId}`);
  return response.data;
};

/**
 * Create a new family visit
 */
export const createFamilyVisit = async (familyId: number, data: FamilyVisitCreate): Promise<FamilyVisitRead> => {
  const response = await apiClient.post<FamilyVisitRead>(`/families/${familyId}/visits`, data);
  return response.data;
};

/**
 * Update an existing family visit
 */
export const updateFamilyVisit = async (familyId: number, visitId: number, data: FamilyVisitUpdate): Promise<FamilyVisitRead> => {
  const response = await apiClient.put<FamilyVisitRead>(`/families/${familyId}/visits/${visitId}`, data);
  return response.data;
};

/**
 * Delete a family visit (soft delete)
 */
export const deleteFamilyVisit = async (familyId: number, visitId: number): Promise<void> => {
  await apiClient.delete(`/families/${familyId}/visits/${visitId}`);
};

/**
 * Child Visit API functions
 */

/**
 * List child visits
 */
export const listChildVisits = async (familyId: number, childId: number, params: ListVisitsParams = {}): Promise<ListVisitsResponse<ChildVisitRead>> => {
  const searchParams = new URLSearchParams();
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/families/${familyId}/children/${childId}/visits${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListVisitsResponse<ChildVisitRead>>(url);
  return response.data;
};

/**
 * Fetch a single child visit by ID
 */
export const fetchChildVisit = async (familyId: number, childId: number, visitId: number): Promise<ChildVisitRead> => {
  const response = await apiClient.get<ChildVisitRead>(`/families/${familyId}/children/${childId}/visits/${visitId}`);
  return response.data;
};

/**
 * Create a new child visit
 */
export const createChildVisit = async (familyId: number, childId: number, data: ChildVisitCreate): Promise<ChildVisitRead> => {
  const response = await apiClient.post<ChildVisitRead>(`/families/${familyId}/children/${childId}/visits`, data);
  return response.data;
};

/**
 * Update an existing child visit
 */
export const updateChildVisit = async (familyId: number, childId: number, visitId: number, data: ChildVisitUpdate): Promise<ChildVisitRead> => {
  const response = await apiClient.put<ChildVisitRead>(`/families/${familyId}/children/${childId}/visits/${visitId}`, data);
  return response.data;
};

/**
 * Delete a child visit (soft delete)
 */
export const deleteChildVisit = async (familyId: number, childId: number, visitId: number): Promise<void> => {
  await apiClient.delete(`/families/${familyId}/children/${childId}/visits/${visitId}`);
};

/**
 * Parent Visit API functions
 */

/**
 * List parent visits
 */
export const listParentVisits = async (familyId: number, parentId: number, params: ListVisitsParams = {}): Promise<ListVisitsResponse<ParentVisitRead>> => {
  const searchParams = new URLSearchParams();
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/families/${familyId}/parents/${parentId}/visits${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListVisitsResponse<ParentVisitRead>>(url);
  return response.data;
};

/**
 * Fetch a single parent visit by ID
 */
export const fetchParentVisit = async (familyId: number, parentId: number, visitId: number): Promise<ParentVisitRead> => {
  const response = await apiClient.get<ParentVisitRead>(`/families/${familyId}/parents/${parentId}/visits/${visitId}`);
  return response.data;
};

/**
 * Create a new parent visit
 */
export const createParentVisit = async (familyId: number, parentId: number, data: ParentVisitCreate): Promise<ParentVisitRead> => {
  const response = await apiClient.post<ParentVisitRead>(`/families/${familyId}/parents/${parentId}/visits`, data);
  return response.data;
};

/**
 * Update an existing parent visit
 */
export const updateParentVisit = async (familyId: number, parentId: number, visitId: number, data: ParentVisitUpdate): Promise<ParentVisitRead> => {
  const response = await apiClient.put<ParentVisitRead>(`/families/${familyId}/parents/${parentId}/visits/${visitId}`, data);
  return response.data;
};

/**
 * Delete a parent visit (soft delete)
 */
export const deleteParentVisit = async (familyId: number, parentId: number, visitId: number): Promise<void> => {
  await apiClient.delete(`/families/${familyId}/parents/${parentId}/visits/${visitId}`);
};

export const visitsApi = {
  listFamilyVisits,
  fetchFamilyVisit,
  createFamilyVisit,
  updateFamilyVisit,
  deleteFamilyVisit,
  listChildVisits,
  fetchChildVisit,
  createChildVisit,
  updateChildVisit,
  deleteChildVisit,
  listParentVisits,
  fetchParentVisit,
  createParentVisit,
  updateParentVisit,
  deleteParentVisit,
};