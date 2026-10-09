import { z } from 'zod';
import { PhotoOwnerTypeEnum } from './enums.js';

// ownerId has no foreign key — the service layer must verify the row named by
// ownerType exists before inserting. Entry and exit photos are NOT attachments;
// they are named FK slots on Enrollment.
export const PhotoAttachmentCreateSchema = z.object({
  fileId: z.number().int().positive(),
  ownerType: PhotoOwnerTypeEnum,
  ownerId: z.number().int().positive(),
  caption: z.string().max(512).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const PhotoAttachmentUpdateSchema = PhotoAttachmentCreateSchema.pick({
  caption: true,
  sortOrder: true,
}).partial();

export const PhotoAttachmentReadSchema = z.object({
  id: z.number().int().positive(),
  fileId: z.number().int().positive(),
  ownerType: PhotoOwnerTypeEnum,
  ownerId: z.number().int().positive(),
  caption: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
});

// Bulk reorder for one owner's gallery. photoIds arrive in the order the client
// wants them; the service writes the index as sortOrder.
export const PhotoAttachmentReorderSchema = z.object({
  ownerType: PhotoOwnerTypeEnum,
  ownerId: z.number().int().positive(),
  photoIds: z.array(z.number().int().positive()).min(1),
});

export type PhotoAttachmentReorder = z.infer<typeof PhotoAttachmentReorderSchema>;
export type PhotoAttachmentCreate = z.infer<typeof PhotoAttachmentCreateSchema>;
export type PhotoAttachmentUpdate = z.infer<typeof PhotoAttachmentUpdateSchema>;
export type PhotoAttachmentRead = z.infer<typeof PhotoAttachmentReadSchema>;
