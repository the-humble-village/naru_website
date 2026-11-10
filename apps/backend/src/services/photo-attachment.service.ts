import { HTTPException } from 'hono/http-exception';
import {
  type PhotoAttachmentCreate,
  type PhotoAttachmentUpdate,
  type PhotoAttachmentRead,
  type PhotoOwnerType,
  type UserRead,
} from '@naru/shared';
import prisma from '../db.js';

const PHOTO_SELECT = {
  id: true,
  fileId: true,
  ownerType: true,
  ownerId: true,
  caption: true,
  sortOrder: true,
  createdAt: true,
  // Explicitly exclude deletedAt
} as const;

// photo_attachment.ownerId carries no foreign key (SCHEMA_V2.md §6.5), so this
// map is the only thing standing between the table and a photo hung off a row
// that does not exist — or worse, off the id of a row in a different table.
const OWNER_MODEL: Record<PhotoOwnerType, { model: string; label: string }> = {
  VISIT: { model: 'visit', label: 'Visit' },
  CHILD: { model: 'child', label: 'Child' },
  MOTHER: { model: 'mother', label: 'Mother' },
  PERSON: { model: 'person', label: 'Person' },
  FAMILY: { model: 'family', label: 'Family' },
  EVENT: { model: 'event', label: 'Event' },
};

function toPhotoRead(row: any): PhotoAttachmentRead {
  return {
    id: row.id,
    fileId: row.fileId,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    caption: row.caption,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPhotoAttachments(options: {
  ownerType?: PhotoOwnerType;
  ownerId?: number;
  fileId?: number;
  skip?: number;
  limit?: number;
  user: UserRead;
}): Promise<{ photos: PhotoAttachmentRead[]; total: number }> {
  if ((options.ownerType === undefined) !== (options.ownerId === undefined)) {
    throw new HTTPException(400, {
      message: 'ownerType and ownerId must be supplied together',
    });
  }

  const skip = Math.max(0, options.skip || 0);
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const where: any = {};
  if (options.ownerType !== undefined) where.ownerType = options.ownerType;
  if (options.ownerId !== undefined) where.ownerId = options.ownerId;
  if (options.fileId !== undefined) where.fileId = options.fileId;

  const [rows, total] = await Promise.all([
    prisma.photoAttachment.findMany({
      where,
      skip,
      take: limit,
      select: PHOTO_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.photoAttachment.count({ where }),
  ]);

  return { photos: rows.map(toPhotoRead), total };
}

export async function getPhotoAttachmentById(
  photoId: number,
  user: UserRead
): Promise<PhotoAttachmentRead> {
  const photo = await prisma.photoAttachment.findUnique({
    where: { id: photoId },
    select: PHOTO_SELECT,
  });

  if (!photo) {
    throw new HTTPException(404, { message: 'Photo attachment not found' });
  }

  return toPhotoRead(photo);
}

export async function createPhotoAttachment(
  data: PhotoAttachmentCreate,
  user: UserRead
): Promise<PhotoAttachmentRead> {
  await Promise.all([assertFileExists(data.fileId), assertOwnerExists(data.ownerType, data.ownerId)]);

  const created = await prisma.photoAttachment.create({
    data: {
      fileId: data.fileId,
      ownerType: data.ownerType,
      ownerId: data.ownerId,
      caption: data.caption ?? null,
      sortOrder: data.sortOrder,
    },
    select: PHOTO_SELECT,
  });

  return toPhotoRead(created);
}

/**
 * Update an attachment's caption or position. fileId, ownerType and ownerId are
 * immutable — the Zod schema omits them, so they cannot arrive here at all.
 */
export async function updatePhotoAttachment(
  photoId: number,
  data: PhotoAttachmentUpdate,
  user: UserRead
): Promise<PhotoAttachmentRead> {
  const existing = await prisma.photoAttachment.findUnique({
    where: { id: photoId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Photo attachment not found' });
  }

  const updateData: any = {};
  if (data.caption !== undefined) updateData.caption = data.caption;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const updated = await prisma.photoAttachment.update({
    where: { id: photoId },
    data: updateData,
    select: PHOTO_SELECT,
  });

  return toPhotoRead(updated);
}

export async function deletePhotoAttachment(photoId: number, user: UserRead): Promise<void> {
  const existing = await prisma.photoAttachment.findUnique({
    where: { id: photoId },
    select: { id: true },
  });

  if (!existing) {
    throw new HTTPException(404, { message: 'Photo attachment not found' });
  }

  await prisma.photoAttachment.update({
    where: { id: photoId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Rewrite the running order of one owner's photos in a single transaction. The
 * client sends the ids in the order it wants them; anything it omits keeps the
 * position it already had.
 */
export async function reorderPhotoAttachments(
  ownerType: PhotoOwnerType,
  ownerId: number,
  photoIds: number[],
  user: UserRead
): Promise<{ photos: PhotoAttachmentRead[]; total: number }> {
  await assertOwnerExists(ownerType, ownerId);

  const owned = await prisma.photoAttachment.findMany({
    where: { ownerType, ownerId },
    select: { id: true },
  });

  const ownedIds = new Set(owned.map((row: { id: number }) => row.id));
  const foreign = photoIds.filter((id) => !ownedIds.has(id));

  if (foreign.length > 0) {
    throw new HTTPException(404, {
      message: `Photo attachment not found on this owner: ${foreign.join(', ')}`,
    });
  }

  if (new Set(photoIds).size !== photoIds.length) {
    throw new HTTPException(400, { message: 'Duplicate photo id in reorder request' });
  }

  await prisma.$transaction(async (tx: any) => {
    for (const [index, id] of photoIds.entries()) {
      await tx.photoAttachment.update({ where: { id }, data: { sortOrder: index } });
    }
  });

  return listPhotoAttachments({ ownerType, ownerId, user });
}

async function assertFileExists(fileId: number): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { id: true } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }
}

async function assertOwnerExists(ownerType: PhotoOwnerType, ownerId: number): Promise<void> {
  const { model, label } = OWNER_MODEL[ownerType];

  const row = await (prisma as any)[model].findFirst({
    where: { id: ownerId },
    select: { id: true },
  });

  if (!row) {
    throw new HTTPException(404, { message: `${label} not found` });
  }
}
