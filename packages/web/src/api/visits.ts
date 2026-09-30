import { apiClient } from './client';
import { VisitRead, VisitListItem, VisitCreate, VisitUpdate, VisitPrefill } from '@naru/shared';

export interface ListVisitsParams {
  enrollmentId?: number;
  programId?: number;
  siteId?: number;
  communityId?: number;
  eventId?: number;
  recordedById?: number;
  from?: string;
  to?: string;
  skip?: number;
  limit?: number;
}

export interface ListVisitsResponse {
  items: VisitListItem[];
  total: number;
  skip: number;
  limit: number;
}

export const listVisits = async (params: ListVisitsParams = {}): Promise<ListVisitsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.enrollmentId !== undefined)
    searchParams.set('enrollmentId', params.enrollmentId.toString());
  if (params.programId !== undefined) searchParams.set('programId', params.programId.toString());
  if (params.siteId !== undefined) searchParams.set('siteId', params.siteId.toString());
  if (params.communityId !== undefined)
    searchParams.set('communityId', params.communityId.toString());
  if (params.eventId !== undefined) searchParams.set('eventId', params.eventId.toString());
  if (params.recordedById !== undefined)
    searchParams.set('recordedById', params.recordedById.toString());
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/visits${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListVisitsResponse>(url);
  return response.data;
};

export const fetchVisitPrefill = async (enrollmentId: number): Promise<VisitPrefill> => {
  const searchParams = new URLSearchParams({ enrollmentId: enrollmentId.toString() });
  const response = await apiClient.get<VisitPrefill>(`/visits/prefill?${searchParams.toString()}`);
  return response.data;
};

export const fetchVisit = async (id: number): Promise<VisitRead> => {
  const response = await apiClient.get<VisitRead>(`/visits/${id}`);
  return response.data;
};

export const createVisit = async (data: VisitCreate): Promise<VisitRead> => {
  const response = await apiClient.post<VisitRead>('/visits', data);
  return response.data;
};

export const updateVisit = async (id: number, data: VisitUpdate): Promise<VisitRead> => {
  const response = await apiClient.put<VisitRead>(`/visits/${id}`, data);
  return response.data;
};

export const deleteVisit = async (id: number): Promise<void> => {
  await apiClient.delete(`/visits/${id}`);
};

export const visitsApi = {
  listVisits,
  fetchVisitPrefill,
  fetchVisit,
  createVisit,
  updateVisit,
  deleteVisit,
};
