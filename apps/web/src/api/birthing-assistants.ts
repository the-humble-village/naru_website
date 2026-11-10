import { apiClient } from './client';
import { BirthingAssistantRead, BirthingAssistantCreate, BirthingAssistantUpdate } from '@naru/shared';

/**
 * Fetch all birthing assistants
 */
export const fetchBirthingAssistants = async (): Promise<BirthingAssistantRead[]> => {
  const response = await apiClient.get<BirthingAssistantRead[]>('/birthing-assistants');
  return response.data;
};

/**
 * Fetch a single birthing assistant by ID
 */
export const fetchBirthingAssistant = async (id: number): Promise<BirthingAssistantRead> => {
  const response = await apiClient.get<BirthingAssistantRead>(`/birthing-assistants/${id}`);
  return response.data;
};

/**
 * Create a new birthing assistant
 */
export const createBirthingAssistant = async (data: BirthingAssistantCreate): Promise<BirthingAssistantRead> => {
  const response = await apiClient.post<BirthingAssistantRead>('/birthing-assistants', data);
  return response.data;
};

/**
 * Update an existing birthing assistant
 */
export const updateBirthingAssistant = async (id: number, data: BirthingAssistantUpdate): Promise<BirthingAssistantRead> => {
  const response = await apiClient.put<BirthingAssistantRead>(`/birthing-assistants/${id}`, data);
  return response.data;
};

/**
 * Delete a birthing assistant (soft delete)
 */
export const deleteBirthingAssistant = async (id: number): Promise<void> => {
  await apiClient.delete(`/birthing-assistants/${id}`);
};

export const birthingAssistantsApi = {
  fetchBirthingAssistants,
  fetchBirthingAssistant,
  createBirthingAssistant,
  updateBirthingAssistant,
  deleteBirthingAssistant,
};