import { apiClient } from './client';
import { MotherRead, MotherCreate, MotherUpdate } from '@naru/shared';

export interface ListMothersParams {
  familyId?: number;
  midwifeId?: number;
  communityId?: number;
  siteId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ListMothersResponse {
  items: MotherRead[];
  total: number;
  skip: number;
  limit: number;
}

export const listMothers = async (params: ListMothersParams = {}): Promise<ListMothersResponse> => {
  const searchParams = new URLSearchParams();

  if (params.familyId !== undefined) searchParams.set('familyId', params.familyId.toString());
  if (params.midwifeId !== undefined) searchParams.set('midwifeId', params.midwifeId.toString());
  if (params.communityId !== undefined)
    searchParams.set('communityId', params.communityId.toString());
  if (params.siteId !== undefined) searchParams.set('siteId', params.siteId.toString());
  if (params.unenrolled) searchParams.set('unenrolled', 'true');
  if (params.search) searchParams.set('search', params.search);
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/mothers${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListMothersResponse>(url);
  return response.data;
};

export const fetchMother = async (id: number): Promise<MotherRead> => {
  const response = await apiClient.get<MotherRead>(`/mothers/${id}`);
  return response.data;
};

export const createMother = async (data: MotherCreate): Promise<MotherRead> => {
  const response = await apiClient.post<MotherRead>('/mothers', data);
  return response.data;
};

export const updateMother = async (id: number, data: MotherUpdate): Promise<MotherRead> => {
  const response = await apiClient.put<MotherRead>(`/mothers/${id}`, data);
  return response.data;
};

export const deleteMother = async (id: number): Promise<void> => {
  await apiClient.delete(`/mothers/${id}`);
};

export const mothersApi = {
  listMothers,
  fetchMother,
  createMother,
  updateMother,
  deleteMother,
};
