import { apiClient } from './client';
import { SearchQuery, SearchResponse } from '@naru/shared';

/**
 * Search across families, parents, children by name
 */
export const searchByName = async (query: string): Promise<SearchResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set('q', query.trim());

  const url = `/search?${searchParams.toString()}`;
  const response = await apiClient.get<SearchResponse>(url);
  return response.data;
};

export const searchApi = {
  searchByName,
};