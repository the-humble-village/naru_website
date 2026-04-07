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

export const dashboardApi = {
  fetchDashboardData,
};