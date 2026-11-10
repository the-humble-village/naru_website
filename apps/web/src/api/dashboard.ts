import { apiClient } from './client';
import { DashboardResponse } from '@naru/shared';

/**
 * Fetch dashboard data including recent visits, recently updated children,
 * families in crisis, and summary statistics
 */
export const fetchDashboardData = async (): Promise<DashboardResponse> => {
  const response = await apiClient.get<DashboardResponse>('/dashboard');
  return response.data;
};

export interface UnenrolledCount {
  children: number;
  mothers: number;
  people: number;
  families: number;
  total: number;
}

/**
 * Fetch the count of subjects with no active enrollment — drives the sidebar badge
 */
export const fetchUnenrolledCount = async (): Promise<UnenrolledCount> => {
  const response = await apiClient.get<UnenrolledCount>('/dashboard/unenrolled-count');
  return response.data;
};

export const dashboardApi = {
  fetchDashboardData,
  fetchUnenrolledCount,
};