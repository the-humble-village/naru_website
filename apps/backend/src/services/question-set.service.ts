import { HTTPException } from 'hono/http-exception';
import {
  type QuestionSetCreate,
  type QuestionSetUpdate,
  type QuestionSetRead,
} from '@naru/shared';
import prisma from '../db.js';

const SET_SELECT = {
  id: true,
  name: true,
  programId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      questionId: true,
      sortOrder: true,
      question: {
        select: { title: true, answerType: true, choices: true, deletedAt: true },
      },
    },
  },
  // Explicitly exclude deletedAt
} as const;

/**
 * A retired question stays in its sets so historical answers remain readable,
 * but it must not be offered on a new visit form — so it is dropped here rather
 * than at the call site. The soft-delete extension cannot do this: it only
 * rewrites the top-level where, never a nested relation.
 */
function fmt(set: any): QuestionSetRead {
  return {
    id: set.id,
    name: set.name,
    programId: set.programId,
    createdAt: set.createdAt.toISOString(),
    updatedAt: set.updatedAt.toISOString(),
    items: set.items
      .filter((item: any) => item.question.deletedAt === null)
      .map((item: any) => ({
        id: item.id,
        questionId: item.questionId,
        questionTitle: item.question.title,
        answerType: item.question.answerType,
        choices: (item.question.choices as string[] | null) ?? null,
        sortOrder: item.sortOrder,
      })),
  };
}

/**
 * List question sets.
 *
 * `includeShared` ORs in the sets with a null programId — those are available to
 * every program, and it is what the visit form asks for. Without it the filter is
 * an exact match, which is what the admin screen wants.
 */
export async function listQuestionSets(options: {
  programId?: number;
  includeShared?: boolean;
} = {}): Promise<QuestionSetRead[]> {
  const where: any = {};

  if (options.programId !== undefined) {
    where.OR = options.includeShared
      ? [{ programId: options.programId }, { programId: null }]
      : [{ programId: options.programId }];
  }

  const sets = await prisma.questionSet.findMany({
    where,
    select: SET_SELECT,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

  return sets.map(fmt);
}

export async function getQuestionSet(id: number): Promise<QuestionSetRead> {
  const set = await prisma.questionSet.findUnique({ where: { id }, select: SET_SELECT });
  if (!set) throw new HTTPException(404, { message: 'Question set not found' });
  return fmt(set);
}

export async function createQuestionSet(data: QuestionSetCreate): Promise<QuestionSetRead> {
  await assertProgramExists(data.programId);
  await assertQuestionsExist(data.questionIds);

  const set = await prisma.questionSet.create({
    data: {
      name: data.name,
      programId: data.programId ?? null,
      items: { create: toItemRows(data.questionIds) },
    },
    select: SET_SELECT,
  });

  return fmt(set);
}

/**
 * Update a question set. An absent `questionIds` leaves the membership alone; a
 * present one replaces it wholesale, with the array order becoming the order the
 * questions are asked in.
 *
 * Retired questions are exempt from the replacement. `fmt` hides them, so a
 * client round-tripping the set it was served would otherwise delete them —
 * taking last year's answers out of their set along with them. A retired
 * question can never appear in `questionIds` (assertQuestionsExist reads through
 * the soft-delete filter and 404s), so keeping those rows cannot collide with
 * the incoming list.
 */
export async function updateQuestionSet(
  id: number,
  data: QuestionSetUpdate
): Promise<QuestionSetRead> {
  const existing = await prisma.questionSet.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HTTPException(404, { message: 'Question set not found' });

  await assertProgramExists(data.programId);
  if (data.questionIds !== undefined) await assertQuestionsExist(data.questionIds);

  const retiredQuestionIds =
    data.questionIds === undefined ? [] : await findRetiredMemberIds(id);

  const set = await prisma.questionSet.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.programId !== undefined && { programId: data.programId ?? null }),
      ...(data.questionIds !== undefined && {
        items: {
          deleteMany: { questionId: { notIn: retiredQuestionIds } },
          create: toItemRows(data.questionIds),
        },
      }),
      updatedAt: new Date(),
    },
    select: SET_SELECT,
  });

  return fmt(set);
}

async function findRetiredMemberIds(setId: number): Promise<number[]> {
  const items = await prisma.questionSetItem.findMany({
    where: { setId, question: { deletedAt: { not: null } } },
    select: { questionId: true },
  });

  return items.map((item: { questionId: number }) => item.questionId);
}

export async function deleteQuestionSet(id: number): Promise<void> {
  const existing = await prisma.questionSet.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HTTPException(404, { message: 'Question set not found' });
  await prisma.questionSet.update({ where: { id }, data: { deletedAt: new Date() } });
}

// The array's order is the order the questions are asked in — the client reorders
// by resending the list, not by computing sortOrder values.
function toItemRows(questionIds: number[]) {
  return questionIds.map((questionId, index) => ({ questionId, sortOrder: index }));
}

async function assertProgramExists(programId: number | null | undefined): Promise<void> {
  if (!programId) return;

  const program = await prisma.program.findFirst({
    where: { id: programId },
    select: { id: true },
  });

  if (!program) throw new HTTPException(404, { message: 'Program not found' });
}

async function assertQuestionsExist(questionIds: number[]): Promise<void> {
  if (questionIds.length === 0) return;

  const seen = new Set<number>();
  const duplicate = questionIds.find((id) => (seen.has(id) ? true : (seen.add(id), false)));

  if (duplicate !== undefined) {
    throw new HTTPException(400, {
      message: `Duplicate question id ${duplicate} — each question may appear only once in a set`,
    });
  }

  const rows = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true },
  });

  if (rows.length !== questionIds.length) {
    const found = new Set(rows.map((row: { id: number }) => row.id));
    const missing = questionIds.filter((id) => !found.has(id));

    throw new HTTPException(404, { message: `Question not found: ${missing.join(', ')}` });
  }
}
