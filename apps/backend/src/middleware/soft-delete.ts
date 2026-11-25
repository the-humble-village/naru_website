// AI-assisted: see AI-ATTRIBUTION.md
import { Prisma } from '@prisma/client';

// Every read that takes a `where`. One missing from here silently returns, or
// counts, soft-deleted rows.
const FILTERED_READS: ReadonlySet<string> = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

// $allOperations sees the args of every model and operation at once, so Prisma
// cannot narrow them. These are the only parts the extension touches.
type QueryArgs = { where?: Record<string, unknown>; includeDeleted?: boolean };

interface SoftDeleteDelegate {
  update(args: { where: QueryArgs['where']; data: { deletedAt: Date } }): Promise<unknown>;
  updateMany(args: { where: QueryArgs['where']; data: { deletedAt: Date } }): Promise<unknown>;
}

function delegateFor(client: unknown, model: string): SoftDeleteDelegate {
  const name = model.charAt(0).toLowerCase() + model.slice(1);
  return (client as Record<string, SoftDeleteDelegate>)[name]!;
}

/**
 * Marks a read's args so the extension below leaves soft-deleted rows in. Prisma's
 * types do not know about `includeDeleted`, so it cannot be written inline.
 */
export function withDeleted<const T extends object>(args: T): T {
  return { ...args, includeDeleted: true };
}

/**
 * Prisma extension that automatically filters out soft-deleted records
 * for models that have a `deletedAt` field.
 *
 * Scope: this only rewrites the TOP-LEVEL `where` of a query. Relations pulled
 * in through `include`/`select` are NOT filtered, so a soft-deleted row can
 * still surface as a nested object. Those call sites must filter explicitly,
 * e.g. `include: { items: { where: { question: { deletedAt: null } } } }`.
 */
export const softDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const softDeleteModels = new Set([
            'User',
            'Person',
            'Mother',
            'Child',
            'Family',
            'Program',
            'Enrollment',
            'Visit',
            'Question',
            'QuestionSet',
            'File',
            'PhotoAttachment',
            'Event',
            'BirthingAssistant',
            'Community',
            'Site',
            'Resource',
            'Training',
            'ExaminationType',
          ]);

          if (!model || !softDeleteModels.has(model)) {
            return query(args);
          }

          // Filter out soft-deleted records for read operations
          if (FILTERED_READS.has(operation)) {
            const contextArgs = (args || {}) as QueryArgs;
            if (contextArgs.includeDeleted) {
              const { includeDeleted, ...restArgs } = contextArgs;
              return query(restArgs as typeof args);
            }
            contextArgs.where = { deletedAt: null, ...contextArgs.where };
            return query(contextArgs as typeof args);
          }

          // Prevent operations on soft-deleted records for updates
          if (['update', 'updateMany'].includes(operation)) {
            const contextArgs = (args || {}) as QueryArgs;
            contextArgs.where = { deletedAt: null, ...contextArgs.where };
            return query(contextArgs as typeof args);
          }

          // Convert delete to soft delete (update)
          if (operation === 'delete') {
            const contextArgs = (args || {}) as QueryArgs;
            return delegateFor(client, model).update({
              where: contextArgs.where,
              data: { deletedAt: new Date() },
            });
          }

          if (operation === 'deleteMany') {
            const contextArgs = (args || {}) as QueryArgs;
            return delegateFor(client, model).updateMany({
              where: contextArgs.where,
              data: { deletedAt: new Date() },
            });
          }

          return query(args);
        },
      },
    },
  });
});
