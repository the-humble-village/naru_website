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

        const context = Prisma.getExtensionContext(this);

        // Filter out soft-deleted records for read operations
        if (['findMany', 'findFirst', 'findUnique', 'count'].includes(operation)) {
          const contextArgs = (args || {}) as any;
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
          return (context as any).update({
            where: contextArgs.where,
            data: { deletedAt: new Date() },
          });
        }

        if (operation === 'deleteMany') {
          const contextArgs = (args || {}) as any;
          return (context as any).updateMany({
            where: contextArgs.where,
            data: { deletedAt: new Date() },
          });
        }

        return query(args);
      },
    },
  },
});
