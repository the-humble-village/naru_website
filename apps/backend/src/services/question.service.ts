import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@prisma/client';
import { type QuestionCreate, type QuestionUpdate, type QuestionRead } from '@naru/shared';
import prisma from '../db.js';

function fmt(q: any): QuestionRead {
  return {
    id: q.id,
    title: q.title,
    answerType: q.answerType,
    choices: (q.choices as string[] | null) ?? null,
    sortOrder: q.sortOrder,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

export async function listQuestions(): Promise<QuestionRead[]> {
  const questions = await prisma.question.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return questions.map(fmt);
}

export async function getQuestion(id: number): Promise<QuestionRead> {
  const question = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!question) throw new HTTPException(404, { message: 'Question not found' });
  return fmt(question);
}

export async function createQuestion(data: QuestionCreate): Promise<QuestionRead> {
  const question = await prisma.question.create({
    data: {
      title: data.title,
      answerType: data.answerType,
      choices: data.choices ?? undefined,
      sortOrder: data.sortOrder,
    },
  });
  return fmt(question);
}

/**
 * Update a question.
 *
 * answerType and choices are validated together (a CHOICE question needs choices,
 * and nothing else may carry them). A partial update can change one without the
 * other, so the two are re-checked against the merged result rather than against
 * whatever the caller happened to send.
 */
export async function updateQuestion(id: number, data: QuestionUpdate): Promise<QuestionRead> {
  const existing = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Question not found' });

  const answerType = data.answerType ?? existing.answerType;
  const choices =
    data.choices !== undefined ? data.choices : ((existing.choices as string[] | null) ?? null);

  if (answerType === 'CHOICE' && (!choices || choices.length === 0)) {
    throw new HTTPException(400, {
      message: 'choices is required when answerType is CHOICE',
    });
  }

  if (answerType !== 'CHOICE' && choices && choices.length > 0) {
    throw new HTTPException(400, {
      message: 'choices is only valid when answerType is CHOICE',
    });
  }

  const question = await prisma.question.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.answerType !== undefined && { answerType: data.answerType }),
      ...(data.choices !== undefined && { choices: data.choices ?? Prisma.DbNull }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });

  return fmt(question);
}

/**
 * Soft delete a question. Existing visit_answer rows keep pointing at it — the
 * answer a worker recorded last year is still a fact, so historical visits must
 * stay readable after an admin retires the question.
 */
export async function deleteQuestion(id: number): Promise<void> {
  const existing = await prisma.question.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Question not found' });
  await prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
}
