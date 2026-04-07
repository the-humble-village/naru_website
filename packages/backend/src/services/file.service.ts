import crypto from 'crypto';
import prisma from '../db';
import { HTTPException } from 'hono/http-exception';
import type { FileCreate, FileRead, FileUploadResponse } from '@naru/shared';

/**
 * Calculate SHA-256 hash of buffer data
 */
export function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  return ext ? ext.toLowerCase() : '';
}

/**
 * Store a file in the database with SHA-256 deduplication
 * @param buffer - File binary data
 * @param originalFilename - Original filename (for extension)
 * @returns FileUploadResponse with file metadata and dedup status
 */
export async function storeFile(
  buffer: Buffer,
  originalFilename: string
): Promise<FileUploadResponse> {
  const hash = calculateHash(buffer);
  const extension = getFileExtension(originalFilename);

  // Check if file with same hash already exists (deduplication)
  const existingFile = await prisma.file.findUnique({
    where: { hash },
  });

  if (existingFile) {
    // File already exists - return existing file info
    return {
      file: {
        id: existingFile.id,
        hash: existingFile.hash,
        extension: existingFile.extension,
        createdAt: existingFile.createdAt.toISOString(),
      },
      url: `/api/files/${existingFile.id}/download`,
      wasDeduped: true,
    };
  }

  // Create new file record
  const file = await prisma.file.create({
    data: {
      hash,
      extension,
    },
  });

  // TODO: Store file binary data to filesystem or S3
  // For now, we'll store the hash and extension but the actual binary storage
  // would need to be implemented based on deployment requirements

  return {
    file: {
      id: file.id,
      hash: file.hash,
      extension: file.extension,
      createdAt: file.createdAt.toISOString(),
    },
    url: `/api/files/${file.id}/download`,
    wasDeduped: false,
  };
}

/**
 * Get file metadata by ID
 */
export async function getFileById(id: number): Promise<FileRead> {
  const file = await prisma.file.findUnique({
    where: { id },
  });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  return {
    id: file.id,
    hash: file.hash,
    extension: file.extension,
    createdAt: file.createdAt.toISOString(),
  };
}

/**
 * Get file binary data by ID
 * TODO: Implement actual file retrieval from storage
 */
export async function getFileBinary(id: number): Promise<{ buffer: Buffer; extension: string }> {
  const file = await prisma.file.findUnique({
    where: { id },
  });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  // TODO: Retrieve actual file binary data from filesystem/S3
  // For now, return a placeholder empty buffer
  // In production, this would read the file from storage using the hash as filename

  throw new HTTPException(501, { message: 'File download not implemented yet' });
}

/**
 * Delete a file by ID (hard delete since files don't use soft delete)
 * Note: This should only be used by admin functions, not exposed via API
 */
export async function deleteFile(id: number): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id },
  });

  if (!file) {
    throw new HTTPException(404, { message: 'File not found' });
  }

  // TODO: Delete actual file from filesystem/S3

  // Delete database record
  await prisma.file.delete({
    where: { id },
  });
}