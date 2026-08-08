import { apiClient } from './client';
import { FamilyRead, FamilyCreate, FamilyUpdate } from '@naru/shared';

/**
 * List families with pagination and filtering options
 */
export interface ListFamiliesParams {
  search?: string;
  communityId?: number;
  siteId?: number;
  inCrisis?: boolean;
  skip?: number;
  limit?: number;
}

export interface ListFamiliesResponse {
  families: FamilyRead[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Fetch a paginated list of families with optional filters
 */
export const listFamilies = async (params: ListFamiliesParams = {}): Promise<ListFamiliesResponse> => {
  const searchParams = new URLSearchParams();

  if (params.search) searchParams.set('search', params.search);
  if (params.communityId) searchParams.set('communityId', params.communityId.toString());
  if (params.siteId) searchParams.set('siteId', params.siteId.toString());
  if (params.inCrisis !== undefined) searchParams.set('inCrisis', params.inCrisis.toString());
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/families${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListFamiliesResponse>(url);
  return response.data;
};

/**
 * Fetch a single family by ID
 */
export const fetchFamily = async (id: number): Promise<FamilyRead> => {
  const response = await apiClient.get<FamilyRead>(`/families/${id}`);
  return response.data;
};

/**
 * Create a new family
 */
export const createFamily = async (data: FamilyCreate): Promise<FamilyRead> => {
  const response = await apiClient.post<FamilyRead>('/families', data);
  return response.data;
};

/**
 * Update an existing family
 */
export const updateFamily = async (id: number, data: FamilyUpdate): Promise<FamilyRead> => {
  const response = await apiClient.put<FamilyRead>(`/families/${id}`, data);
  return response.data;
};

/**
 * Delete a family (soft delete)
 */
export const deleteFamily = async (id: number): Promise<void> => {
  await apiClient.delete(`/families/${id}`);
};

export const familiesApi = {
  listFamilies,
  fetchFamily,
  createFamily,
  updateFamily,
  deleteFamily,
};