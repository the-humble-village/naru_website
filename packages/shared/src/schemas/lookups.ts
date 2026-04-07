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

// Specific schemas for each lookup table type
export const CommunityCreateSchema = LookupCreateSchema;
export const CommunityUpdateSchema = LookupUpdateSchema;
export const CommunityReadSchema = LookupReadSchema;

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

export const ResourceCreateSchema = LookupCreateSchema;
export const ResourceUpdateSchema = LookupUpdateSchema;
export const ResourceReadSchema = LookupReadSchema;

export const TrainingCreateSchema = LookupCreateSchema;
export const TrainingUpdateSchema = LookupUpdateSchema;
export const TrainingReadSchema = LookupReadSchema;

export const ChildVisitQuestionCreateSchema = LookupCreateSchema;
export const ChildVisitQuestionUpdateSchema = LookupUpdateSchema;
export const ChildVisitQuestionReadSchema = LookupReadSchema;

export const ParentVisitQuestionCreateSchema = LookupCreateSchema;
export const ParentVisitQuestionUpdateSchema = LookupUpdateSchema;
export const ParentVisitQuestionReadSchema = LookupReadSchema;

export const FamilyVisitQuestionCreateSchema = LookupCreateSchema;
export const FamilyVisitQuestionUpdateSchema = LookupUpdateSchema;
export const FamilyVisitQuestionReadSchema = LookupReadSchema;

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

export type ChildVisitQuestionCreate = z.infer<typeof ChildVisitQuestionCreateSchema>;
export type ChildVisitQuestionUpdate = z.infer<typeof ChildVisitQuestionUpdateSchema>;
export type ChildVisitQuestionRead = z.infer<typeof ChildVisitQuestionReadSchema>;

export type ParentVisitQuestionCreate = z.infer<typeof ParentVisitQuestionCreateSchema>;
export type ParentVisitQuestionUpdate = z.infer<typeof ParentVisitQuestionUpdateSchema>;
export type ParentVisitQuestionRead = z.infer<typeof ParentVisitQuestionReadSchema>;

export type FamilyVisitQuestionCreate = z.infer<typeof FamilyVisitQuestionCreateSchema>;
export type FamilyVisitQuestionUpdate = z.infer<typeof FamilyVisitQuestionUpdateSchema>;
export type FamilyVisitQuestionRead = z.infer<typeof FamilyVisitQuestionReadSchema>;