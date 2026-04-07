import { PrismaClient } from '@prisma/client';

/**
 * Prisma middleware that automatically filters out soft-deleted records
 * by adding `deletedAt: null` condition to findMany, findFirst, and findUnique queries.
 *
 * Models that support soft delete are those with a `deletedAt` field.
 * The File model does not have soft delete (content-addressed, never deleted).
 */
export function applySoftDeleteMiddleware(prisma: PrismaClient): void {
  // @ts-ignore - Prisma middleware types may not be fully available
  if (typeof prisma.$use === 'function') {
    // @ts-ignore - Using any types for middleware params until proper types are available
    prisma.$use(async (params: any, next: any) => {
      // Models that support soft delete (have deletedAt field)
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

      // Only apply to models that support soft delete
      if (!softDeleteModels.has(params.model || '')) {
        return next(params);
      }

      // Apply soft delete filter for read operations
      if (['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
        if (!params.args) {
          params.args = {};
        }
        if (!params.args.where) {
          params.args.where = {};
        }

        // Only add the filter if deletedAt is not explicitly specified
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      // For update and delete operations, also add the soft delete filter to prevent
      // operations on already deleted records (unless explicitly overridden)
      if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
        if (!params.args) {
          params.args = {};
        }
        if (!params.args.where) {
          params.args.where = {};
        }

        // Only add the filter if deletedAt is not explicitly specified
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }

      // For delete operations, convert to soft delete by setting deletedAt
      if (params.action === 'delete' || params.action === 'deleteMany') {
        params.action = params.action === 'delete' ? 'update' : 'updateMany';
        params.args = {
          ...params.args,
          data: {
            deletedAt: new Date(),
          },
        };
      }

      return next(params);
    });
  } else {
    console.warn('Prisma middleware not available - soft delete filtering will be handled in service layer');
  }
}