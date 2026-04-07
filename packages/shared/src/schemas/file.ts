import { z } from 'zod';

// File creation schema (for upload)
export const FileCreateSchema = z.object({
  hash: z.string().max(256), // SHA-256 hash
  extension: z.string().max(128),
});

// File read schema (what's returned from API - no deletedAt for files)
export const FileReadSchema = z.object({
  id: z.number().int().positive(),
  hash: z.string(),
  extension: z.string(),
  createdAt: z.string().datetime(),
});

// File upload response schema (returned after successful upload)
export const FileUploadResponseSchema = z.object({
  file: FileReadSchema,
  url: z.string().url(), // URL for accessing the file
  wasDeduped: z.boolean(), // True if file already existed (SHA-256 match)
});

// Inferred types for TypeScript
export type FileCreate = z.infer<typeof FileCreateSchema>;
export type FileRead = z.infer<typeof FileReadSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;