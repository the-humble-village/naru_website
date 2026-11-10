import { apiClient } from './client';
import { type SiteCreate, type SiteUpdate, type SiteRead } from '@naru/shared';

export const sitesApi = {
  list: async (): Promise<SiteRead[]> => (await apiClient.get<SiteRead[]>('/sites')).data,
  fetch: async (id: number): Promise<SiteRead> => (await apiClient.get<SiteRead>(`/sites/${id}`)).data,
  create: async (data: SiteCreate): Promise<SiteRead> => (await apiClient.post<SiteRead>('/sites', data)).data,
  update: async (id: number, data: SiteUpdate): Promise<SiteRead> => (await apiClient.put<SiteRead>(`/sites/${id}`, data)).data,
  delete: async (id: number): Promise<void> => { await apiClient.delete(`/sites/${id}`); },
};
