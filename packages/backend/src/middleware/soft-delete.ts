import { Prisma } from '@prisma/client';

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
            'Family',
            'Parent',
            'Child',
            'ChildVisit',
            'FamilyVisit',
            'ParentVisit',
            'File',
            'BirthingAssistant',
            'Community',
            'Site',
            'Resource',
            'Training',
            'ChildVisitQuestion',
            'ParentVisitQuestion',
            'FamilyVisitQuestion',
            'ChildVisitQuestionSet',
            'ParentVisitQuestionSet',
            'FamilyVisitQuestionSet',
          ]);

          if (!model || !softDeleteModels.has(model)) {
            return query(args);
          }

          // Filter out soft-deleted records for read operations
          if (['findMany', 'findFirst', 'findUnique', 'count'].includes(operation)) {
            const contextArgs = (args || {}) as any;
            if (contextArgs.includeDeleted) {
              const { includeDeleted, ...restArgs } = contextArgs;
              return query(restArgs);
            }
            contextArgs.where = { deletedAt: null, ...contextArgs.where };
            return query(contextArgs);
          }

          // Prevent operations on soft-deleted records for updates
          if (['update', 'updateMany'].includes(operation)) {
            const contextArgs = (args || {}) as any;
            contextArgs.where = { deletedAt: null, ...contextArgs.where };
            return query(contextArgs);
          }

          // Convert delete to soft delete (update)
          if (operation === 'delete') {
            const contextArgs = (args || {}) as any;
            const m = model as string;
            const modelName = m.charAt(0).toLowerCase() + m.slice(1);
            return (client as any)[modelName].update({
              where: contextArgs.where,
              data: { deletedAt: new Date() },
            });
          }

          if (operation === 'deleteMany') {
            const contextArgs = (args || {}) as any;
            const m = model as string;
            const modelName = m.charAt(0).toLowerCase() + m.slice(1);
            return (client as any)[modelName].updateMany({
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
