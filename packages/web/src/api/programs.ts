import { apiClient } from './client';
import { ProgramRead, ProgramCreate, ProgramUpdate, ProgramKind } from '@naru/shared';

export interface ListProgramsParams {
  kind?: ProgramKind;
  activeOnly?: boolean;
}

export interface ListProgramsResponse {
  items: ProgramRead[];
  total: number;
}

export const listPrograms = async (params: ListProgramsParams = {}): Promise<ListProgramsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.kind) searchParams.set('kind', params.kind);
  if (params.activeOnly) searchParams.set('activeOnly', 'true');

  const url = `/programs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<ListProgramsResponse>(url);
  return response.data;
};

export const fetchProgram = async (id: number): Promise<ProgramRead> => {
  const response = await apiClient.get<ProgramRead>(`/programs/${id}`);
  return response.data;
};

export const createProgram = async (data: ProgramCreate): Promise<ProgramRead> => {
  const response = await apiClient.post<ProgramRead>('/programs', data);
  return response.data;
};

export const updateProgram = async (id: number, data: ProgramUpdate): Promise<ProgramRead> => {
  const response = await apiClient.put<ProgramRead>(`/programs/${id}`, data);
  return response.data;
};

export const deleteProgram = async (id: number): Promise<void> => {
  await apiClient.delete(`/programs/${id}`);
};

export const programsApi = {
  listPrograms,
  fetchProgram,
  createProgram,
  updateProgram,
  deleteProgram,
};
