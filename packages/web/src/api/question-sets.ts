import { apiClient } from './client';
import { type QuestionSetCreate, type QuestionSetUpdate, type QuestionSetRead } from '@naru/shared';

type VisitType = 'child' | 'parent' | 'family';

export const questionSetsApi = {
  list: async (visitType: VisitType): Promise<QuestionSetRead[]> => {
    const res = await apiClient.get<QuestionSetRead[]>(`/question-sets/${visitType}`);
    return res.data;
  },
  fetch: async (visitType: VisitType, id: number): Promise<QuestionSetRead> => {
    const res = await apiClient.get<QuestionSetRead>(`/question-sets/${visitType}/${id}`);
    return res.data;
  },
  create: async (visitType: VisitType, data: QuestionSetCreate): Promise<QuestionSetRead> => {
    const res = await apiClient.post<QuestionSetRead>(`/question-sets/${visitType}`, data);
    return res.data;
  },
  update: async (visitType: VisitType, id: number, data: QuestionSetUpdate): Promise<QuestionSetRead> => {
    const res = await apiClient.put<QuestionSetRead>(`/question-sets/${visitType}/${id}`, data);
    return res.data;
  },
  delete: async (visitType: VisitType, id: number): Promise<void> => {
    await apiClient.delete(`/question-sets/${visitType}/${id}`);
  },
};
