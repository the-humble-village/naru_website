import { randomUUID } from 'crypto';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HTTPException } from 'hono/http-exception';
import type { FileRead, PresignUploadResponse } from '@naru/shared';
import prisma from '../db.js';
import { s3, BUCKET } from '../s3.js';

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

  // Generate presigned PUT URL (15 min expiry)
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: params.mimeType,
    ContentLength: params.size,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

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

  // Verify the file exists in S3
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: file.s3Key }));
  } catch {
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

  const urls = await Promise.all(
    files.map(async (file: { id: number; s3Key: string }) => {
      const command = new GetObjectCommand({ Bucket: BUCKET, Key: file.s3Key });
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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

  // Delete from S3
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.s3Key }));
  } catch {
    // Log but don't fail — the DB record should still be cleaned up
    console.error(`Failed to delete S3 object ${file.s3Key}`);
  }

  await prisma.file.delete({ where: { id } });
}
