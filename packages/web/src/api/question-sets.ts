import { apiClient } from './client';
import { QuestionSetRead, QuestionSetCreate, QuestionSetUpdate } from '@naru/shared';

export interface ListQuestionSetsParams {
  programId?: number;
  includeShared?: boolean;
}

export const listQuestionSets = async (
  params: ListQuestionSetsParams = {}
): Promise<QuestionSetRead[]> => {
  const searchParams = new URLSearchParams();

  if (params.programId !== undefined) searchParams.set('programId', params.programId.toString());
  if (params.includeShared !== undefined)
    searchParams.set('includeShared', params.includeShared ? 'true' : 'false');

  const url = `/question-sets${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await apiClient.get<QuestionSetRead[]>(url);
  return response.data;
};

export const fetchQuestionSet = async (id: number): Promise<QuestionSetRead> => {
  const response = await apiClient.get<QuestionSetRead>(`/question-sets/${id}`);
  return response.data;
};

export const createQuestionSet = async (data: QuestionSetCreate): Promise<QuestionSetRead> => {
  const response = await apiClient.post<QuestionSetRead>('/question-sets', data);
  return response.data;
};

export const updateQuestionSet = async (
  id: number,
  data: QuestionSetUpdate
): Promise<QuestionSetRead> => {
  const response = await apiClient.put<QuestionSetRead>(`/question-sets/${id}`, data);
  return response.data;
};

export const deleteQuestionSet = async (id: number): Promise<void> => {
  await apiClient.delete(`/question-sets/${id}`);
};

export const questionSetsApi = {
  listQuestionSets,
  fetchQuestionSet,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
};
