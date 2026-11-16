import { apiClient } from './client';
import { QuestionRead, QuestionCreate, QuestionUpdate } from '@naru/shared';

export const listQuestions = async (): Promise<QuestionRead[]> => {
  const response = await apiClient.get<QuestionRead[]>('/questions');
  return response.data;
};

export const fetchQuestion = async (id: number): Promise<QuestionRead> => {
  const response = await apiClient.get<QuestionRead>(`/questions/${id}`);
  return response.data;
};

export const createQuestion = async (data: QuestionCreate): Promise<QuestionRead> => {
  const response = await apiClient.post<QuestionRead>('/questions', data);
  return response.data;
};

export const updateQuestion = async (id: number, data: QuestionUpdate): Promise<QuestionRead> => {
  const response = await apiClient.put<QuestionRead>(`/questions/${id}`, data);
  return response.data;
};

export const deleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`/questions/${id}`);
};

export const questionsApi = {
  listQuestions,
  fetchQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
