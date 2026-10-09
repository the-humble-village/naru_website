import { apiClient } from './client';
import { PersonRead, PersonCreate, PersonUpdate } from '@naru/shared';

export interface ListPeopleParams {
  communityId?: number;
  siteId?: number;
  programId?: number;
  unenrolled?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface ListPeopleResponse {
  items: PersonRead[];
  total: number;
  skip: number;
  limit: number;
}

export interface AssignedMother {
  id: number;
  name: string;
  communityId: number | null;
}

export interface AssignedMothersResponse {
  items: AssignedMother[];
  total: number;
}

export const listPeople = async (params: ListPeopleParams = {}): Promise<ListPeopleResponse> => {
  const searchParams = new URLSearchParams();

  if (params.communityId !== undefined)
    searchParams.set('communityId', params.communityId.toString());
  if (params.siteId !== undefined) searchParams.set('siteId', params.siteId.toString());
  if (params.programId !== undefined) searchParams.set('programId', params.programId.toString());
  if (params.unenrolled) searchParams.set('unenrolled', 'true');
  if (params.search) searchParams.set('search', params.search);
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/people${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListPeopleResponse>(url);
  return response.data;
};

export const fetchPerson = async (id: number): Promise<PersonRead> => {
  const response = await apiClient.get<PersonRead>(`/people/${id}`);
  return response.data;
};

export const fetchAssignedMothers = async (id: number): Promise<AssignedMothersResponse> => {
  const response = await apiClient.get<AssignedMothersResponse>(`/people/${id}/mothers`);
  return response.data;
};

export const createPerson = async (data: PersonCreate): Promise<PersonRead> => {
  const response = await apiClient.post<PersonRead>('/people', data);
  return response.data;
};

export const updatePerson = async (id: number, data: PersonUpdate): Promise<PersonRead> => {
  const response = await apiClient.put<PersonRead>(`/people/${id}`, data);
  return response.data;
};

export const deletePerson = async (id: number): Promise<void> => {
  await apiClient.delete(`/people/${id}`);
};

export const peopleApi = {
  listPeople,
  fetchPerson,
  fetchAssignedMothers,
  createPerson,
  updatePerson,
  deletePerson,
};
