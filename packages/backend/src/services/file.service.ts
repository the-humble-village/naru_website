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

function toFileRead(file: {
  id: number;
  hash: string | null;
  extension: string;
  s3Key: string;
  mimeType: string;
  size: number;
  confirmed: boolean;
  createdAt: Date;
}): FileRead {
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
  const file = await prisma.file.findUnique({ where: { id: fileId } });

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
    where: { id: { in: fileIds }, confirmed: true },
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
  const file = await prisma.file.findUnique({ where: { id } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  return toFileRead(file);
}

/**
 * Delete a file by ID (hard delete).
 * Removes from both S3 and database.
 */
export async function deleteFile(id: number): Promise<void> {
  const file = await prisma.file.findUnique({ where: { id } });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  // Delete from the backing store (best-effort; never blocks the DB cleanup)
  await getStorage().delete(file.s3Key);

  await prisma.file.delete({ where: { id } });
}
