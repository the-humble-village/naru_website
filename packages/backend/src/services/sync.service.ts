import { HTTPException } from 'hono/http-exception';
import {
  type SyncRequest,
  type SyncResponse,
  type SyncResult,
  type SyncChange,
  type UserRead,
  type FamilyCreate,
  type ParentCreate,
  type ChildCreate,
  type ChildVisitCreate,
  type FamilyVisitCreate,
  type BirthingAssistantCreate,
  FamilyCreateSchema,
  ParentCreateSchema,
  ChildCreateSchema,
  ChildVisitCreateSchema,
  FamilyVisitCreateSchema,
  BirthingAssistantCreateSchema,
} from '@naru/shared';
import prisma from '../db';

// Dependency order for processing sync changes
const ENTITY_DEPENDENCY_ORDER = [
  'family',
  'parent',
  'child',
  'familyVisit',
  'childVisit',
  'birthingAssistant'
] as const;

// Map for localId to serverId resolution within a transaction
type LocalIdMap = Map<string, number>;

/**
 * Process a sync request from a client
 */
export async function processSyncRequest(
  syncRequest: SyncRequest,
  user: UserRead
): Promise<SyncResponse> {
  const results: SyncResult[] = [];
  const localIdMap: LocalIdMap = new Map();

  try {
    // Process all changes in a single transaction
    await prisma.$transaction(async (tx) => {
      // Sort changes by dependency order
      const sortedChanges = [...syncRequest.changes].sort((a, b) => {
        const aIndex = ENTITY_DEPENDENCY_ORDER.indexOf(a.entity as any);
        const bIndex = ENTITY_DEPENDENCY_ORDER.indexOf(b.entity as any);
        return aIndex - bIndex;
      });

      // Process each change
      for (const change of sortedChanges) {
        const result = await processChange(change, localIdMap, tx);
        results.push(result);
      }
    });
  } catch (error) {
    console.error('Sync transaction failed:', error);
    throw new HTTPException(500, {
      message: 'Sync operation failed. All changes have been rolled back.'
    });
  }

  // Get server changes (scoped to user's access)
  const serverChanges = await getServerChanges(syncRequest.lastSyncedAt, user);

  return {
    syncedAt: new Date().toISOString(),
    results,
    serverChanges,
    errors: [],
  };
}

/**
 * Process a single sync change
 */
async function processChange(
  change: SyncChange,
  localIdMap: LocalIdMap,
  tx: any
): Promise<SyncResult> {
  // Only accept create operations
  if (change.operation !== 'create') {
    throw new Error(`Invalid operation: ${change.operation}. Only 'create' operations are supported.`);
  }

  // Check for duplicate localId first
  const existingRecord = await findExistingRecordByLocalId(change.entity, change.localId, tx);
  if (existingRecord) {
    return {
      localId: change.localId,
      serverId: existingRecord.id,
      status: 'already_exists',
    };
  }

  try {
    // Resolve parentLocalId if provided
    const resolvedData = resolveParentLocalId(change, localIdMap);

    // Validate and create the record
    const serverId = await createRecord(change.entity, resolvedData, tx);

    // Store in localId map for future references
    localIdMap.set(change.localId, serverId);

    return {
      localId: change.localId,
      serverId,
      status: 'created',
    };
  } catch (error) {
    console.error(`Failed to create ${change.entity}:`, error);
    throw error; // Re-throw the original error to be handled by the transaction catch block
  }
}

/**
 * Find existing record by localId
 */
async function findExistingRecordByLocalId(
  entity: string,
  localId: string,
  tx: any
): Promise<{ id: number } | null> {
  switch (entity) {
    case 'family':
      return tx.family.findUnique({ where: { localId }, select: { id: true } });
    case 'parent':
      return tx.parent.findUnique({ where: { localId }, select: { id: true } });
    case 'child':
      return tx.child.findUnique({ where: { localId }, select: { id: true } });
    case 'childVisit':
      return tx.childVisit.findUnique({ where: { localId }, select: { id: true } });
    case 'familyVisit':
      return tx.familyVisit.findUnique({ where: { localId }, select: { id: true } });
    case 'birthingAssistant':
      return tx.birthingAssistant.findUnique({ where: { localId }, select: { id: true } });
    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}

/**
 * Resolve parentLocalId to actual database ID
 */
function resolveParentLocalId(change: SyncChange, localIdMap: LocalIdMap): any {
  const data = { ...change.data };

  // If parentLocalId is provided, resolve it to familyId
  if (change.parentLocalId) {
    const familyId = localIdMap.get(change.parentLocalId);
    if (!familyId) {
      throw new Error(
        `Cannot resolve parentLocalId ${change.parentLocalId}. Parent record must be processed first.`
      );
    }
    data.familyId = familyId;
    delete data.parentLocalId;
  }

  // Add localId from the change
  data.localId = change.localId;

  return data;
}

/**
 * Create a new record in the database
 */
async function createRecord(entity: string, data: any, tx: any): Promise<number> {
  switch (entity) {
    case 'family': {
      const validatedData = FamilyCreateSchema.parse(data);
      const family = await tx.family.create({
        data: {
          familyName: validatedData.familyName,
          childrenEditable: validatedData.childrenEditable ?? 0,
          inCrisis: validatedData.inCrisis ?? false,
          notes: validatedData.notes,
          communityId: validatedData.communityId,
          siteId: validatedData.siteId,
          birthingAssistantId: validatedData.birthingAssistantId,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return family.id;
    }

    case 'parent': {
      const validatedData = ParentCreateSchema.parse(data);
      const parent = await tx.parent.create({
        data: {
          familyId: validatedData.familyId,
          name: validatedData.name,
          role: validatedData.role,
          birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
          dateEntered: validatedData.dateEntered ? new Date(validatedData.dateEntered) : null,
          photoId: validatedData.photoId,
          reasonEnroll: validatedData.reasonEnroll,
          dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
          notes: validatedData.notes,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return parent.id;
    }

    case 'child': {
      const validatedData = ChildCreateSchema.parse(data);
      const child = await tx.child.create({
        data: {
          familyId: validatedData.familyId,
          name: validatedData.name,
          birthDate: new Date(validatedData.birthDate),
          sex: validatedData.sex,
          dateEntered: validatedData.dateEntered ? new Date(validatedData.dateEntered) : null,
          photoId: validatedData.photoId,
          weight: validatedData.weight ?? 0,
          nutritionalState: validatedData.nutritionalState,
          reasonEnrollment: validatedData.reasonEnrollment,
          observations: validatedData.observations,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return child.id;
    }

    case 'childVisit': {
      const validatedData = ChildVisitCreateSchema.parse(data);
      const childVisit = await tx.childVisit.create({
        data: {
          familyId: validatedData.familyId,
          childId: validatedData.childId,
          visitDate: new Date(validatedData.visitDate),
          weight: validatedData.weight ?? 0,
          armCircumference: validatedData.armCircumference ?? 0,
          height: validatedData.height ?? 0,
          incap: validatedData.incap ?? false,
          leche: validatedData.leche ?? false,
          bagsGiven: validatedData.bagsGiven,
          recvAnyMedicine: validatedData.recvAnyMedicine,
          leftFromProg: validatedData.leftFromProg,
          passedAway: validatedData.passedAway,
          questions: validatedData.questions ?? [],
          notes: validatedData.notes,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return childVisit.id;
    }

    case 'familyVisit': {
      const validatedData = FamilyVisitCreateSchema.parse(data);
      const familyVisit = await tx.familyVisit.create({
        data: {
          familyId: validatedData.familyId,
          visitDate: new Date(validatedData.visitDate),
          trainingsReceived: validatedData.trainingsReceived ?? [],
          resourcesReceived: validatedData.resourcesReceived ?? [],
          questions: validatedData.questions ?? [],
          notes: validatedData.notes,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return familyVisit.id;
    }

    case 'birthingAssistant': {
      const validatedData = BirthingAssistantCreateSchema.parse(data);
      const birthingAssistant = await tx.birthingAssistant.create({
        data: {
          name: validatedData.name,
          localId: validatedData.localId,
        },
        select: { id: true },
      });

      // Handle community associations
      if (validatedData.communityIds && validatedData.communityIds.length > 0) {
        await Promise.all(
          validatedData.communityIds.map(communityId =>
            tx.birthingAssistantCommunity.create({
              data: {
                birthingAssistantId: birthingAssistant.id,
                communityId,
              },
            })
          )
        );
      }

      // Handle training associations
      if (validatedData.trainingIds && validatedData.trainingIds.length > 0) {
        await Promise.all(
          validatedData.trainingIds.map(trainingId =>
            tx.birthingAssistantTraining.create({
              data: {
                birthingAssistantId: birthingAssistant.id,
                trainingId,
              },
            })
          )
        );
      }

      return birthingAssistant.id;
    }

    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}

/**
 * Get server changes since last sync (scoped to user's access)
 */
async function getServerChanges(lastSyncedAt: string | null, user: UserRead): Promise<any> {
  const since = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

  // Build where clause based on user role
  // For now, simplified - in a real implementation, caseworkers would only see assigned families
  const familyWhere: any = {
    updatedAt: { gt: since },
  };

  // TODO: Add proper access scoping when user assignment is implemented
  // if (user.role === 'CASEWORKER') {
  //   familyWhere.assignedUserId = user.id;
  // }

  // Get all updated records
  const [families, parents, children, childVisits, familyVisits] = await Promise.all([
    prisma.family.findMany({
      where: familyWhere,
      select: {
        id: true,
        localId: true,
        familyName: true,
        childrenEditable: true,
        inCrisis: true,
        notes: true,
        communityId: true,
        siteId: true,
        birthingAssistantId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.parent.findMany({
      where: {
        updatedAt: { gt: since },
        // TODO: Add family access scoping
      },
      select: {
        id: true,
        localId: true,
        familyId: true,
        name: true,
        role: true,
        birthDate: true,
        dateEntered: true,
        photoId: true,
        reasonEnroll: true,
        dueDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.child.findMany({
      where: {
        updatedAt: { gt: since },
        // TODO: Add family access scoping
      },
      select: {
        id: true,
        localId: true,
        familyId: true,
        name: true,
        birthDate: true,
        sex: true,
        dateEntered: true,
        photoId: true,
        weight: true,
        nutritionalState: true,
        reasonEnrollment: true,
        observations: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.childVisit.findMany({
      where: {
        updatedAt: { gt: since },
        // TODO: Add family access scoping via child relationship
      },
      select: {
        id: true,
        localId: true,
        familyId: true,
        childId: true,
        visitDate: true,
        weight: true,
        armCircumference: true,
        height: true,
        incap: true,
        leche: true,
        bagsGiven: true,
        recvAnyMedicine: true,
        leftFromProg: true,
        passedAway: true,
        questions: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.familyVisit.findMany({
      where: {
        updatedAt: { gt: since },
        // TODO: Add family access scoping
      },
      select: {
        id: true,
        localId: true,
        familyId: true,
        visitDate: true,
        trainingsReceived: true,
        resourcesReceived: true,
        questions: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // Get all lookup tables (always included)
  const [
    communities,
    sites,
    resources,
    training,
    childVisitQuestions,
    parentVisitQuestions,
    familyVisitQuestions,
  ] = await Promise.all([
    prisma.community.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.site.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.resource.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.training.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.childVisitQuestion.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.parentVisitQuestion.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
    prisma.familyVisitQuestion.findMany({
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    }),
  ]);

  // Transform dates to ISO strings
  const transformDates = (records: any[]) =>
    records.map(record => ({
      ...record,
      birthDate: record.birthDate?.toISOString(),
      dateEntered: record.dateEntered?.toISOString(),
      dueDate: record.dueDate?.toISOString(),
      visitDate: record.visitDate?.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));

  return {
    families: transformDates(families),
    parents: transformDates(parents),
    children: transformDates(children),
    childVisits: transformDates(childVisits),
    familyVisits: transformDates(familyVisits),
    lookups: {
      communities: transformDates(communities),
      sites: transformDates(sites),
      resources: transformDates(resources),
      training: transformDates(training),
      childVisitQuestions: transformDates(childVisitQuestions),
      parentVisitQuestions: transformDates(parentVisitQuestions),
      familyVisitQuestions: transformDates(familyVisitQuestions),
    },
  };
}