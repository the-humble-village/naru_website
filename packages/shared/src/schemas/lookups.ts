import { z } from 'zod';

// Generic lookup table creation schema
export const LookupCreateSchema = z.object({
  title: z.string().max(1024).min(1),
});

// Generic lookup table update schema
export const LookupUpdateSchema = LookupCreateSchema.partial();

// Generic lookup table read schema
export const LookupReadSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  sortOrder: z.number().int().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Note: deletedAt is never exposed to clients
});

// Reorder payload: array of { id, sortOrder }
export const LookupReorderSchema = z.array(
  z.object({ id: z.number().int().positive(), sortOrder: z.number().int() })
);
export type LookupReorder = z.infer<typeof LookupReorderSchema>;

// Site is a rollup of Community: a community names its site, and a subject's
// site is derived from its community. No subject carries an independent site
// field, so the two can never contradict each other.
export const CommunityCreateSchema = LookupCreateSchema.extend({
  siteId: z.number().int().positive().nullable().optional(),
});
export const CommunityUpdateSchema = CommunityCreateSchema.partial();
export const CommunityReadSchema = LookupReadSchema.extend({
  siteId: z.number().int().nullable().optional(),
});

export const SiteCreateSchema = LookupCreateSchema.extend({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  boundary: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
});
export const SiteUpdateSchema = SiteCreateSchema.partial();
export const SiteReadSchema = LookupReadSchema.extend({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  boundary: z.array(z.tuple([z.number(), z.number()])).nullable().optional(),
});

export const ResourceCreateSchema = LookupCreateSchema.extend({
  defaultUnit: z.string().max(32).nullable().optional(),
});
export const ResourceUpdateSchema = ResourceCreateSchema.partial();
export const ResourceReadSchema = LookupReadSchema.extend({
  defaultUnit: z.string().nullable().optional(),
});

export const TrainingCreateSchema = LookupCreateSchema;
export const TrainingUpdateSchema = LookupUpdateSchema;
export const TrainingReadSchema = LookupReadSchema;

export const ExaminationTypeCreateSchema = LookupCreateSchema;
export const ExaminationTypeUpdateSchema = LookupUpdateSchema;
export const ExaminationTypeReadSchema = LookupReadSchema;

// Inferred types for TypeScript
export type LookupCreate = z.infer<typeof LookupCreateSchema>;
export type LookupUpdate = z.infer<typeof LookupUpdateSchema>;
export type LookupRead = z.infer<typeof LookupReadSchema>;

export type CommunityCreate = z.infer<typeof CommunityCreateSchema>;
export type CommunityUpdate = z.infer<typeof CommunityUpdateSchema>;
export type CommunityRead = z.infer<typeof CommunityReadSchema>;

export type SiteCreate = z.infer<typeof SiteCreateSchema>;
export type SiteUpdate = z.infer<typeof SiteUpdateSchema>;
export type SiteRead = z.infer<typeof SiteReadSchema>;
export type LatLng = [number, number]; // [lng, lat] GeoJSON order

export type ResourceCreate = z.infer<typeof ResourceCreateSchema>;
export type ResourceUpdate = z.infer<typeof ResourceUpdateSchema>;
export type ResourceRead = z.infer<typeof ResourceReadSchema>;

export type TrainingCreate = z.infer<typeof TrainingCreateSchema>;
export type TrainingUpdate = z.infer<typeof TrainingUpdateSchema>;
export type TrainingRead = z.infer<typeof TrainingReadSchema>;

export type ExaminationTypeCreate = z.infer<typeof ExaminationTypeCreateSchema>;
export type ExaminationTypeUpdate = z.infer<typeof ExaminationTypeUpdateSchema>;
export type ExaminationTypeRead = z.infer<typeof ExaminationTypeReadSchema>;
