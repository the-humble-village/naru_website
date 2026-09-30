import { z } from 'zod';
import { AnswerTypeEnum } from './enums.js';

// `choices` is required when answerType is CHOICE and meaningless otherwise.
const QuestionBaseSchema = z.object({
  title: z.string().min(1).max(1024),
  answerType: AnswerTypeEnum,
  choices: z.array(z.string().min(1)).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

function choicesMatchAnswerType(
  value: { answerType?: z.infer<typeof AnswerTypeEnum>; choices?: string[] | null },
  ctx: z.RefinementCtx
): void {
  if (value.answerType === 'CHOICE' && (!value.choices || value.choices.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'choices is required when answerType is CHOICE',
      path: ['choices'],
    });
  }

  if (value.answerType && value.answerType !== 'CHOICE' && value.choices && value.choices.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'choices is only valid when answerType is CHOICE',
      path: ['choices'],
    });
  }
}

export const QuestionCreateSchema = QuestionBaseSchema.superRefine(choicesMatchAnswerType);
export const QuestionUpdateSchema = QuestionBaseSchema.partial().superRefine(choicesMatchAnswerType);

export const QuestionReadSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  answerType: AnswerTypeEnum,
  choices: z.array(z.string()).nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Question sets attach to a program, because visits are organised by program
// rather than by entity type. A null programId is a set available to any program.
export const QuestionSetCreateSchema = z.object({
  name: z.string().min(1).max(256),
  programId: z.number().int().positive().optional().nullable(),
  questionIds: z.array(z.number().int().positive()).default([]),
});

export const QuestionSetUpdateSchema = QuestionSetCreateSchema.partial();

export const QuestionSetItemReadSchema = z.object({
  id: z.number().int().positive(),
  questionId: z.number().int().positive(),
  questionTitle: z.string(),
  answerType: AnswerTypeEnum,
  choices: z.array(z.string()).nullable(),
  sortOrder: z.number().int(),
});

export const QuestionSetReadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  programId: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(QuestionSetItemReadSchema),
});

export type QuestionCreate = z.infer<typeof QuestionCreateSchema>;
export type QuestionUpdate = z.infer<typeof QuestionUpdateSchema>;
export type QuestionRead = z.infer<typeof QuestionReadSchema>;
export type QuestionSetCreate = z.infer<typeof QuestionSetCreateSchema>;
export type QuestionSetUpdate = z.infer<typeof QuestionSetUpdateSchema>;
export type QuestionSetItemRead = z.infer<typeof QuestionSetItemReadSchema>;
export type QuestionSetRead = z.infer<typeof QuestionSetReadSchema>;
