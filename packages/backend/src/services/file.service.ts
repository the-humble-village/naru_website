import { randomUUID } from 'crypto';
import { HTTPException } from 'hono/http-exception';
import type { FileRead, PresignUploadResponse } from '@naru/shared';
import prisma from '../db.js';
import { getStorage } from '../storage/index.js';

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

function buildS3Key(extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `uploads/${yyyy}/${mm}/${dd}/${randomUUID()}.${extension}`;
}

/**
 * Every model that stores photo references. `photos` is an untyped Json array of
 * File ids with no FK, so detaching a deleted file means rewriting each array by
 * hand — there is no cascade to lean on.
 */
const PHOTO_OWNER_MODELS = [
  'family',
  'parent',
  'child',
  'childVisit',
  'familyVisit',
  'parentVisit',
] as const;

/**
 * The slice of a Prisma model delegate this service needs. Declared structurally
 * so the six photo-owning delegates can be iterated over uniformly without `any`
 * (`src/db.ts` exports the extended client as `any`, so nothing is inferred here).
 */
interface PhotoOwnerDelegate {
  findMany(args: unknown): Promise<Array<{ id: number; photos: unknown }>>;
  update(args: unknown): Promise<unknown>;
}

interface FileRow {
  id: number;
  hash: string | null;
  extension: string;
  s3Key: string;
  mimeType: string;
  size: number;
  confirmed: boolean;
  createdAt: Date;
}

/** The subset of the transaction client `deleteFile` touches. */
type DeleteFileTx = Record<(typeof PHOTO_OWNER_MODELS)[number], PhotoOwnerDelegate> & {
  file: { update(args: { where: { id: number }; data: { deletedAt: Date } }): Promise<FileRow> };
};

function toIdArray(photos: unknown): number[] {
  return Array.isArray(photos) ? photos.filter((p): p is number => typeof p === 'number') : [];
}

function toFileRead(file: FileRow): FileRead {
  return {
    id: file.id,
    hash: file.hash,
    extension: file.extension,
    s3Key: file.s3Key,
    mimeType: file.mimeType,
    size: file.size,
    confirmed: file.confirmed,
    createdAt: file.createdAt.toISOString(),
  };
}

/**
 * Generate a presigned PUT URL for uploading a file to S3.
 * Creates an unconfirmed File record in the database.
 */
export async function presignUpload(params: {
  filename: string;
  mimeType: string;
  size: number;
}): Promise<PresignUploadResponse> {
  const extension = getExtension(params.filename);
  const s3Key = buildS3Key(extension || 'bin');

  // Create unconfirmed file record
  const file = await prisma.file.create({
    data: {
      extension,
      s3Key,
      mimeType: params.mimeType,
      size: params.size,
      confirmed: false,
    },
  });

  // Generate an upload URL (presigned S3 PUT, or a local endpoint in dev)
  const uploadUrl = await getStorage().getUploadUrl(s3Key, params.mimeType, params.size);

  return {
    fileId: file.id,
    uploadUrl,
    s3Key,
  };
}

/**
 * Confirm that a file was successfully uploaded to S3.
 * Verifies the object exists via HeadObject before marking confirmed.
 */
export async function confirmUpload(fileId: number): Promise<FileRead> {
  // NOTE: `File` is deliberately NOT registered in softDeleteExtension, so every
  // read in this service filters `deletedAt: null` explicitly.
  const file = await prisma.file.findFirst({ where: { id: fileId, deletedAt: null } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  if (file.confirmed) {
    return toFileRead(file);
  }

  // Verify the file actually landed in the backing store
  if (!(await getStorage().exists(file.s3Key))) {
    throw new HTTPException(400, { message: 'File not found in S3. Upload may have failed.' });
  }

  const confirmed = await prisma.file.update({
    where: { id: fileId },
    data: { confirmed: true },
  });

  return toFileRead(confirmed);
}

/**
 * Generate presigned GET URLs for a batch of file IDs.
 * Only returns URLs for confirmed files.
 */
export async function presignDownload(
  fileIds: number[]
): Promise<Array<{ fileId: number; url: string }>> {
  const files = await prisma.file.findMany({
    where: { id: { in: fileIds }, confirmed: true, deletedAt: null },
  });

  const storage = getStorage();
  const urls = await Promise.all(
    files.map(async (file: { id: number; s3Key: string; mimeType: string }) => {
      const url = await storage.getDownloadUrl(file.s3Key, file.mimeType);
      return { fileId: file.id, url };
    })
  );

  return urls;
}

/**
 * Get file metadata by ID.
 */
export async function getFileById(id: number): Promise<FileRead> {
  const file = await prisma.file.findFirst({ where: { id, deletedAt: null } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  return toFileRead(file);
}

/**
 * Soft-delete a file and detach it from every record that references it.
 *
 * Three things happen, in this order:
 *  1. The `photos` Json array of every Family/Parent/Child/*Visit that holds this
 *     id is rewritten without it, so no read view renders a dangling photo.
 *  2. The File row is stamped with `deletedAt` (never hard-deleted — see the
 *     soft-delete invariant). Steps 1 and 2 share one transaction.
 *  3. The underlying storage object is removed. This is best-effort: a storage
 *     failure (or an object that was already gone) is logged and swallowed, never
 *     surfaced as a 500, because the DB is already consistent by then.
 */
export async function deleteFile(id: number): Promise<FileRead> {
  const file = await prisma.file.findFirst({ where: { id, deletedAt: null } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  const deleted = await prisma.$transaction(async (tx: DeleteFileTx) => {
    for (const model of PHOTO_OWNER_MODELS) {
      const delegate = tx[model];
      // Postgres jsonb containment: '[1,2,3]' @> '2'. There is no updateMany that
      // can compute a per-row array, so read the referencing rows and rewrite each.
      const owners = await delegate.findMany({
        where: { photos: { array_contains: id } },
        select: { id: true, photos: true },
      });

      for (const owner of owners) {
        await delegate.update({
          where: { id: owner.id },
          data: { photos: toIdArray(owner.photos).filter((photoId) => photoId !== id) },
        });
      }
    }

    return tx.file.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });

  try {
    await getStorage().delete(file.s3Key);
  } catch (error) {
    console.error(`Failed to delete storage object ${file.s3Key} for file ${id}:`, error);
  }

  return toFileRead(deleted);
}
