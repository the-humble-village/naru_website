import { z } from 'zod';

export const QuestionSetCreateSchema = z.object({
  name: z.string().min(1).max(256),
  questionIds: z.array(z.number().int().positive()),
});

export const QuestionSetUpdateSchema = QuestionSetCreateSchema.partial();

export const QuestionSetItemReadSchema = z.object({
  id: z.number().int().positive(),
  questionId: z.number().int().positive(),
  questionTitle: z.string(),
  sortOrder: z.number().int(),
});

export const QuestionSetReadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(QuestionSetItemReadSchema),
});

export type QuestionSetCreate = z.infer<typeof QuestionSetCreateSchema>;
export type QuestionSetUpdate = z.infer<typeof QuestionSetUpdateSchema>;
export type QuestionSetItemRead = z.infer<typeof QuestionSetItemReadSchema>;
export type QuestionSetRead = z.infer<typeof QuestionSetReadSchema>;
