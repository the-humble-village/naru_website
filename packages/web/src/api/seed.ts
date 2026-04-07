import { apiClient } from './client';

interface SeedResult {
  message: string;
  created: {
    communities: number;
    sites: number;
    trainings: number;
    resources: number;
    birthingAssistants: number;
    families: number;
    children: number;
    parents: number;
    childVisits: number;
    familyVisits: number;
  };
}

export async function generateTestData(): Promise<SeedResult> {
  const response = await apiClient.post<SeedResult>('/seed/generate');
  return response.data;
}
