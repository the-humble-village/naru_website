import { HTTPException } from 'hono/http-exception';
import { type QuestionSetCreate, type QuestionSetUpdate, type QuestionSetRead } from '@naru/shared';
import prisma from '../db.js';

type VisitType = 'child' | 'parent' | 'family';

// Returns { setModel, itemModel, questionModel } for the given visit type
function getModels(visitType: VisitType) {
  switch (visitType) {
    case 'child':
      return {
        setModel: prisma.childVisitQuestionSet,
        itemModel: prisma.childVisitQuestionSetItem,
        questionModel: prisma.childVisitQuestion,
      };
    case 'parent':
      return {
        setModel: prisma.parentVisitQuestionSet,
        itemModel: prisma.parentVisitQuestionSetItem,
        questionModel: prisma.parentVisitQuestion,
      };
    case 'family':
      return {
        setModel: prisma.familyVisitQuestionSet,
        itemModel: prisma.familyVisitQuestionSetItem,
        questionModel: prisma.familyVisitQuestion,
      };
    default:
      throw new HTTPException(400, { message: `Invalid visit type: ${visitType}` });
  }
}

function formatSet(set: any): QuestionSetRead {
  return {
    id: set.id,
    name: set.name,
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString(),
    items: (set.items ?? [])
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      .map((item: any) => ({
        id: item.id,
        questionId: item.questionId,
        questionTitle: item.question?.title ?? '',
        sortOrder: item.sortOrder,
      })),
  };
}

const WITH_ITEMS = { items: { include: { question: true } } };

export async function listQuestionSets(visitType: VisitType): Promise<QuestionSetRead[]> {
  const { setModel } = getModels(visitType);
  const sets = await (setModel as any).findMany({
    where: { deletedAt: null },
    include: WITH_ITEMS,
    orderBy: { name: 'asc' },
  });
  return sets.map(formatSet);
}

export async function getQuestionSet(visitType: VisitType, id: number): Promise<QuestionSetRead> {
  const { setModel } = getModels(visitType);
  const found = await (setModel as any).findFirst({
    where: { id, deletedAt: null },
    include: WITH_ITEMS,
  });
  if (!found) throw new HTTPException(404, { message: 'Question set not found' });
  return formatSet(found);
}

async function validateQuestionIds(questionModel: any, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await (questionModel as any).findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new HTTPException(400, { message: 'One or more question IDs are invalid' });
  }
}

export async function createQuestionSet(visitType: VisitType, data: QuestionSetCreate): Promise<QuestionSetRead> {
  const { setModel, questionModel } = getModels(visitType);
  await validateQuestionIds(questionModel, data.questionIds);

  const created = await (setModel as any).create({
    data: {
      name: data.name,
      items: {
        create: data.questionIds.map((questionId, index) => ({ questionId, sortOrder: index })),
      },
    },
    include: WITH_ITEMS,
  });

  return formatSet(created);
}

export async function updateQuestionSet(visitType: VisitType, id: number, data: QuestionSetUpdate): Promise<QuestionSetRead> {
  const { setModel, itemModel, questionModel } = getModels(visitType);

  const existing = await (setModel as any).findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Question set not found' });

  if (data.questionIds !== undefined) {
    await validateQuestionIds(questionModel, data.questionIds);
  }

  if (data.name !== undefined) {
    await (setModel as any).update({ where: { id }, data: { name: data.name } });
  }

  if (data.questionIds !== undefined) {
    await (itemModel as any).deleteMany({ where: { setId: id } });
    if (data.questionIds.length > 0) {
      await (itemModel as any).createMany({
        data: data.questionIds.map((questionId, index) => ({ setId: id, questionId, sortOrder: index })),
      });
    }
  }

  return getQuestionSet(visitType, id);
}

export async function deleteQuestionSet(visitType: VisitType, id: number): Promise<void> {
  const { setModel } = getModels(visitType);
  const existing = await (setModel as any).findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HTTPException(404, { message: 'Question set not found' });
  await (setModel as any).update({ where: { id }, data: { deletedAt: new Date() } });
}
