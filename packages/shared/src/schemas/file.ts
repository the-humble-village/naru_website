import { z } from 'zod';

// File read schema (what's returned from API)
export const FileReadSchema = z.object({
  id: z.number().int().positive(),
  hash: z.string().nullable(),
  extension: z.string(),
  s3Key: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  confirmed: z.boolean(),
  createdAt: z.string().datetime(),
});

// Presign upload request — client tells us what it wants to upload
export const PresignUploadRequestSchema = z.object({
  filename: z.string().min(1).max(256),
  mimeType: z.string().min(1).max(128),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10 MB max
});

// Presign upload response — server returns a presigned PUT URL
export const PresignUploadResponseSchema = z.object({
  fileId: z.number().int().positive(),
  uploadUrl: z.string(),
  s3Key: z.string(),
});

// Confirm upload request — client tells us upload is done
export const ConfirmUploadRequestSchema = z.object({
  fileId: z.number().int().positive(),
});

// Confirm upload response — server returns confirmed file metadata
export const ConfirmUploadResponseSchema = z.object({
  file: FileReadSchema,
});

// Presign download request — client asks for download URLs for a batch of files
export const PresignDownloadRequestSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(50),
});

// Presign download response — server returns presigned GET URLs
export const PresignDownloadResponseSchema = z.object({
  urls: z.array(z.object({
    fileId: z.number().int().positive(),
    url: z.string(),
  })),
});

// Inferred types for TypeScript
export type FileRead = z.infer<typeof FileReadSchema>;
export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;
export type PresignUploadResponse = z.infer<typeof PresignUploadResponseSchema>;
export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequestSchema>;
export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponseSchema>;
export type PresignDownloadRequest = z.infer<typeof PresignDownloadRequestSchema>;
export type PresignDownloadResponse = z.infer<typeof PresignDownloadResponseSchema>;
