import { HTTPException } from 'hono/http-exception';
import { type LookupCreate, type LookupUpdate, type LookupRead, type LookupReorder } from '@naru/shared';
import prisma from '../db.js';

/**
 * Valid lookup table names that can be managed via admin routes
 */
export type LookupTableName =
  | 'communities'
  | 'sites'
  | 'resources'
  | 'training'
  | 'child-visit-questions'
  | 'parent-visit-questions'
  | 'family-visit-questions';

const QUESTION_TABLES = new Set<LookupTableName>([
  'child-visit-questions',
  'parent-visit-questions',
  'family-visit-questions',
]);

/**
 * Mapping of table names to Prisma model names
 */
const TABLE_MODEL_MAP = {
  'communities': 'community',
  'sites': 'site',
  'resources': 'resource',
  'training': 'training',
  'child-visit-questions': 'childVisitQuestion',
  'parent-visit-questions': 'parentVisitQuestion',
  'family-visit-questions': 'familyVisitQuestion',
} as const;

/**
 * Validate that a table name is supported
 */
function validateTableName(table: string): table is LookupTableName {
  return Object.keys(TABLE_MODEL_MAP).includes(table);
}

/**
 * Get the Prisma model for a table name
 */
function getPrismaModel(table: LookupTableName) {
  const modelName = TABLE_MODEL_MAP[table];
  return (prisma as any)[modelName];
}

/**
 * List all entries for a lookup table
 */
export async function listLookupEntries(table: string): Promise<LookupRead[]> {
  if (!validateTableName(table)) {
    throw new HTTPException(400, { message: `Invalid table name: ${table}` });
  }

  const model = getPrismaModel(table);

  const isQuestion = QUESTION_TABLES.has(table);

  const entries = await model.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      ...(isQuestion ? { sortOrder: true } : {}),
      createdAt: true,
      updatedAt: true,
    },
    orderBy: isQuestion
      ? [{ sortOrder: 'asc' }, { id: 'asc' }]
      : { title: 'asc' },
  });

  const entriesRead: LookupRead[] = entries.map((entry: any) => ({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return entriesRead;
}

/**
 * Create a new lookup entry
 */
export async function createLookupEntry(table: string, data: LookupCreate): Promise<LookupRead> {
  if (!validateTableName(table)) {
    throw new HTTPException(400, { message: `Invalid table name: ${table}` });
  }

  const model = getPrismaModel(table);

  // Check if title already exists (case-insensitive, excluding deleted entries)
  const existingEntry = await model.findFirst({
    where: {
      title: {
        equals: data.title,
        mode: 'insensitive',
      },
      deletedAt: null, // Explicit soft delete filter
    },
    select: { id: true },
  });

  if (existingEntry) {
    throw new HTTPException(400, { message: `Entry with title "${data.title}" already exists` });
  }

  const entry = await model.create({
    data: {
      title: data.title,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const entryRead: LookupRead = {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };

  return entryRead;
}

/**
 * Update a lookup entry by ID
 */
export async function updateLookupEntry(table: string, id: number, data: LookupUpdate): Promise<LookupRead> {
  if (!validateTableName(table)) {
    throw new HTTPException(400, { message: `Invalid table name: ${table}` });
  }

  const model = getPrismaModel(table);

  // Check if entry exists (and not deleted)
  const existingEntry = await model.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, title: true },
  });

  if (!existingEntry) {
    throw new HTTPException(404, { message: 'Entry not found' });
  }

  // If updating title, check for uniqueness (case-insensitive, excluding current entry)
  if (data.title && data.title !== existingEntry.title) {
    const titleExists = await model.findFirst({
      where: {
        title: {
          equals: data.title,
          mode: 'insensitive',
        },
        id: {
          not: id,
        },
        deletedAt: null, // Explicit soft delete filter
      },
      select: { id: true },
    });

    if (titleExists) {
      throw new HTTPException(400, { message: `Entry with title "${data.title}" already exists` });
    }
  }

  const updatedEntry = await model.update({
    where: { id },
    data: {
      title: data.title,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      // Explicitly exclude deletedAt
    },
  });

  // Transform dates to ISO strings
  const entryRead: LookupRead = {
    ...updatedEntry,
    createdAt: updatedEntry.createdAt.toISOString(),
    updatedAt: updatedEntry.updatedAt.toISOString(),
  };

  return entryRead;
}

/**
 * Reorder question lookup entries by updating sortOrder for each id
 */
export async function reorderLookupEntries(table: string, items: LookupReorder): Promise<void> {
  if (!validateTableName(table) || !QUESTION_TABLES.has(table)) {
    throw new HTTPException(400, { message: `Reorder not supported for table: ${table}` });
  }

  const model = getPrismaModel(table);

  await prisma.$transaction(
    items.map((item) =>
      model.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
}

/**
 * Delete a lookup entry by ID (soft delete)
 */
export async function deleteLookupEntry(table: string, id: number): Promise<void> {
  if (!validateTableName(table)) {
    throw new HTTPException(400, { message: `Invalid table name: ${table}` });
  }

  const model = getPrismaModel(table);

  // Check if entry exists (and not deleted)
  const existingEntry = await model.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });

  if (!existingEntry) {
    throw new HTTPException(404, { message: 'Entry not found' });
  }

  // Soft delete the entry
  await model.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}