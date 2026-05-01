import { Prisma } from '@prisma/client';

/**
 * Prisma extension that automatically filters out soft-deleted records
 * for models that have a `deletedAt` field.
 */
export const softDeleteExtension = Prisma.defineExtension({
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
          'BirthingAssistant',
          'Community',
          'Site',
          'Resource',
          'Training',
          'ChildVisitQuestion',
          'ParentVisitQuestion',
          'FamilyVisitQuestion',
        ]);

        if (!softDeleteModels.has(model)) {
          return query(args);
        }

        // Apply soft delete filter for read operations
        if (['findMany', 'findFirst', 'findUnique', 'count'].includes(operation)) {
          const contextArgs = args as any;
          if (!contextArgs.where) {
            contextArgs.where = {};
          }

          // Only add the filter if deletedAt is not explicitly specified
          if (contextArgs.where.deletedAt === undefined) {
            contextArgs.where.deletedAt = null;
          }
        }

        // For update operations, also add the soft delete filter to prevent
        // operations on already deleted records
        if (['update', 'updateMany'].includes(operation)) {
          const contextArgs = args as any;
          if (!contextArgs.where) {
            contextArgs.where = {};
          }

          if (contextArgs.where.deletedAt === undefined) {
            contextArgs.where.deletedAt = null;
          }
        }

        // For delete operations, convert to soft delete by setting deletedAt
        if (operation === 'delete') {
          return (query as any).update({
            ...args,
            data: {
              deletedAt: new Date(),
            },
          });
        }

        if (operation === 'deleteMany') {
          return (query as any).updateMany({
            ...args,
            data: {
              deletedAt: new Date(),
            },
          });
        }

        return query(args);
      },
    },
  },
});
