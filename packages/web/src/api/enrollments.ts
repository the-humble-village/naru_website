import { apiClient } from './client';
import {
  EnrollmentRead,
  EnrollmentListItem,
  EnrollmentCreate,
  EnrollmentUpdate,
  EnrollmentExit,
} from '@naru/shared';

export type EnrollmentStatus = 'active' | 'exited' | 'all';

export interface ListEnrollmentsParams {
  programId?: number;
  motherId?: number;
  childId?: number;
  personId?: number;
  familyId?: number;
  status?: EnrollmentStatus;
  onDate?: string;
  communityId?: number;
  siteId?: number;
  skip?: number;
  limit?: number;
}

export interface ListEnrollmentsResponse {
  items: EnrollmentListItem[];
  total: number;
  skip: number;
  limit: number;
}

export const listEnrollments = async (
  params: ListEnrollmentsParams = {}
): Promise<ListEnrollmentsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.programId !== undefined) searchParams.set('programId', params.programId.toString());
  if (params.motherId !== undefined) searchParams.set('motherId', params.motherId.toString());
  if (params.childId !== undefined) searchParams.set('childId', params.childId.toString());
  if (params.personId !== undefined) searchParams.set('personId', params.personId.toString());
  if (params.familyId !== undefined) searchParams.set('familyId', params.familyId.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.onDate) searchParams.set('onDate', params.onDate);
  if (params.communityId !== undefined)
    searchParams.set('communityId', params.communityId.toString());
  if (params.siteId !== undefined) searchParams.set('siteId', params.siteId.toString());
  if (params.skip !== undefined) searchParams.set('skip', params.skip.toString());
  if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());

  const url = `/enrollments${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListEnrollmentsResponse>(url);
  return response.data;
};

export const fetchEnrollment = async (id: number): Promise<EnrollmentRead> => {
  const response = await apiClient.get<EnrollmentRead>(`/enrollments/${id}`);
  return response.data;
};

export const createEnrollment = async (data: EnrollmentCreate): Promise<EnrollmentRead> => {
  const response = await apiClient.post<EnrollmentRead>('/enrollments', data);
  return response.data;
};

export const updateEnrollment = async (
  id: number,
  data: EnrollmentUpdate
): Promise<EnrollmentRead> => {
  const response = await apiClient.put<EnrollmentRead>(`/enrollments/${id}`, data);
  return response.data;
};

export const exitEnrollment = async (
  id: number,
  data: EnrollmentExit
): Promise<EnrollmentRead> => {
  const response = await apiClient.post<EnrollmentRead>(`/enrollments/${id}/exit`, data);
  return response.data;
};

export const reopenEnrollment = async (id: number): Promise<EnrollmentRead> => {
  const response = await apiClient.post<EnrollmentRead>(`/enrollments/${id}/reopen`);
  return response.data;
};

export const deleteEnrollment = async (id: number): Promise<void> => {
  await apiClient.delete(`/enrollments/${id}`);
};

export const enrollmentsApi = {
  listEnrollments,
  fetchEnrollment,
  createEnrollment,
  updateEnrollment,
  exitEnrollment,
  reopenEnrollment,
  deleteEnrollment,
};
