import { HTTPException } from 'hono/http-exception';
import {
  type SyncRequest,
  type SyncResponse,
  type SyncResult,
  type SyncChange,
  type SyncTombstone,
  type SyncDeletableEntity,
  type UserRead,
  type FamilyCreate,
  type ParentCreate,
  type ChildCreate,
  type ChildVisitCreate,
  type FamilyVisitCreate,
  type ParentVisitCreate,
  type BirthingAssistantCreate,
  FamilyCreateSchema,
  ParentCreateSchema,
  ChildCreateSchema,
  ChildVisitCreateSchema,
  FamilyVisitCreateSchema,
  ParentVisitCreateSchema,
  BirthingAssistantCreateSchema,
} from '@naru/shared';
import prisma from '../db.js';

// Dependency order for processing sync changes.
// Visits come after the records they hang off, so a batch that creates a family,
// its parent and that parent's first visit resolves cleanly regardless of the
// order the client sent them in.
const ENTITY_DEPENDENCY_ORDER = [
  'family',
  'parent',
  'child',
  'familyVisit',
  'childVisit',
  'parentVisit',
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
    await prisma.$transaction(async (tx: any) => {
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
    // Still record the mapping: a client retrying a batch whose earlier records
    // already landed sends them again, and later records in the same batch
    // reference them by localId.
    localIdMap.set(change.localId, existingRecord.id);
    return {
      localId: change.localId,
      serverId: existingRecord.id,
      status: 'already_exists',
    };
  }

  try {
    // Resolve any localId references (parentLocalId / localRefs) to server ids
    const resolvedData = await resolveLocalReferences(change, localIdMap, tx);

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
    case 'parentVisit':
      return tx.parentVisit.findUnique({ where: { localId }, select: { id: true } });
    case 'birthingAssistant':
      return tx.birthingAssistant.findUnique({ where: { localId }, select: { id: true } });
    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
}

// Which model each `localRefs` key points at, so an unresolved reference can be
// looked up in the database by localId.
const LOCAL_REF_DELEGATES = {
  familyId: 'family',
  parentId: 'parent',
  childId: 'child',
} as const;

type LocalRefField = keyof typeof LOCAL_REF_DELEGATES;

/**
 * Resolve one localId to a server id: from this batch first, then the database.
 *
 * The database fallback is what makes a retried batch safe. If the client's
 * previous attempt committed but the response never arrived, the referenced
 * record already exists on the server and is absent from `localIdMap` for any
 * change the client dropped from the retry.
 */
async function resolveLocalId(
  field: LocalRefField,
  localId: string,
  localIdMap: LocalIdMap,
  tx: any
): Promise<number> {
  const fromBatch = localIdMap.get(localId);
  if (fromBatch) return fromBatch;

  const delegate = LOCAL_REF_DELEGATES[field];
  const existing = await tx[delegate].findUnique({ where: { localId }, select: { id: true } });
  if (!existing) {
    throw new Error(
      `Cannot resolve ${field} from localId ${localId}. No ${delegate} with that localId exists in this batch or on the server.`
    );
  }

  return existing.id;
}

/**
 * Resolve a change's localId references (`parentLocalId` and `localRefs`) into
 * the foreign keys the create schemas expect.
 */
async function resolveLocalReferences(
  change: SyncChange,
  localIdMap: LocalIdMap,
  tx: any
): Promise<any> {
  const data = { ...change.data };

  // Legacy form: a bare parentLocalId always meant the owning family
  if (change.parentLocalId) {
    data.familyId = await resolveLocalId('familyId', change.parentLocalId, localIdMap, tx);
    delete data.parentLocalId;
  }

  // Explicit per-column references (familyId, parentId, childId)
  for (const [field, refLocalId] of Object.entries(change.localRefs ?? {})) {
    if (!refLocalId) continue;
    data[field] = await resolveLocalId(field as LocalRefField, refLocalId, localIdMap, tx);
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
          photos: validatedData.photos ?? [],
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
          photos: validatedData.photos ?? [],
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
          photos: validatedData.photos ?? [],
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
          photos: validatedData.photos ?? [],
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
          photos: validatedData.photos ?? [],
          notes: validatedData.notes,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return familyVisit.id;
    }

    case 'parentVisit': {
      const validatedData = ParentVisitCreateSchema.parse(data);

      // ParentVisit.familyId has no foreign key of its own (only parentId does),
      // so a mismatched familyId would be stored happily and then never show up
      // in listParentVisits, which filters on familyId + parentId.
      const parent = await tx.parent.findFirst({
        where: { id: validatedData.parentId, familyId: validatedData.familyId },
        select: { id: true },
      });
      if (!parent) {
        throw new Error(
          `Parent ${validatedData.parentId} does not exist in family ${validatedData.familyId}.`
        );
      }

      const parentVisit = await tx.parentVisit.create({
        data: {
          familyId: validatedData.familyId,
          parentId: validatedData.parentId,
          visitDate: new Date(validatedData.visitDate),
          weight: validatedData.weight ?? 0,
          trainingsReceived: validatedData.trainingsReceived ?? [],
          resourcesReceived: validatedData.resourcesReceived ?? [],
          questions: validatedData.questions ?? [],
          photos: validatedData.photos ?? [],
          notes: validatedData.notes,
          localId: validatedData.localId,
        },
        select: { id: true },
      });
      return parentVisit.id;
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
 * Every model a client caches locally that can be soft-deleted on the server.
 *
 * `hasLocalId` marks the models a client can create offline; for those, the
 * tombstone carries the localId so a client can match a record it has not yet
 * learned the server id for.
 */
const TOMBSTONE_SOURCES: ReadonlyArray<{
  entity: SyncDeletableEntity;
  delegate: { findMany: (args: unknown) => Promise<unknown[]> };
  hasLocalId: boolean;
}> = [
  { entity: 'family', delegate: prisma.family, hasLocalId: true },
  { entity: 'parent', delegate: prisma.parent, hasLocalId: true },
  { entity: 'child', delegate: prisma.child, hasLocalId: true },
  { entity: 'childVisit', delegate: prisma.childVisit, hasLocalId: true },
  { entity: 'familyVisit', delegate: prisma.familyVisit, hasLocalId: true },
  { entity: 'parentVisit', delegate: prisma.parentVisit, hasLocalId: true },
  { entity: 'birthingAssistant', delegate: prisma.birthingAssistant, hasLocalId: true },
  { entity: 'community', delegate: prisma.community, hasLocalId: false },
  { entity: 'site', delegate: prisma.site, hasLocalId: false },
  { entity: 'resource', delegate: prisma.resource, hasLocalId: false },
  { entity: 'training', delegate: prisma.training, hasLocalId: false },
  { entity: 'childVisitQuestion', delegate: prisma.childVisitQuestion, hasLocalId: false },
  { entity: 'parentVisitQuestion', delegate: prisma.parentVisitQuestion, hasLocalId: false },
  { entity: 'familyVisitQuestion', delegate: prisma.familyVisitQuestion, hasLocalId: false },
];

/**
 * Collect tombstones for records soft-deleted since the client's last sync.
 *
 * Soft-deleted rows are filtered out of every array in serverChanges (the
 * soft-delete extension injects `deletedAt: null`), so a deletion is invisible
 * to a client that only ever sees the delta — it would keep the record forever.
 */
async function getTombstones(lastSyncedAt: string | null): Promise<SyncTombstone[]> {
  // First sync: the client's local database is empty, so there is nothing to
  // delete. Returning tombstones here would also be unbounded — it would cover
  // every deletion in the system's history.
  if (!lastSyncedAt) return [];

  const since = new Date(lastSyncedAt);

  const perEntity = await Promise.all(
    TOMBSTONE_SOURCES.map(async ({ entity, delegate, hasLocalId }) => {
      const rows = (await delegate.findMany({
        // Tombstones are the one query that deliberately wants deleted rows, so
        // opt out of the soft-delete extension's `deletedAt: null` filter.
        includeDeleted: true,
        where: { deletedAt: { gt: since } },
        select: { id: true, deletedAt: true, ...(hasLocalId ? { localId: true } : {}) },
      })) as Array<{ id: number; deletedAt: Date; localId?: string | null }>;

      return rows.map((row) => ({
        entity,
        id: row.id,
        localId: row.localId ?? null,
        deletedAt: row.deletedAt.toISOString(),
      }));
    })
  );

  return perEntity.flat();
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
  const [families, parents, children, childVisits, familyVisits, parentVisits] = await Promise.all([
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
        photos: true,
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
        photos: true,
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
        photos: true,
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
        photos: true,
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
        photos: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.parentVisit.findMany({
      where: {
        updatedAt: { gt: since },
        // TODO: Add family access scoping
      },
      select: {
        id: true,
        localId: true,
        familyId: true,
        parentId: true,
        visitDate: true,
        weight: true,
        trainingsReceived: true,
        resourcesReceived: true,
        questions: true,
        photos: true,
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

  const deleted = await getTombstones(lastSyncedAt);

  return {
    families: transformDates(families),
    parents: transformDates(parents),
    children: transformDates(children),
    childVisits: transformDates(childVisits),
    familyVisits: transformDates(familyVisits),
    parentVisits: transformDates(parentVisits),
    deleted,
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