import { z } from 'zod';

// Search query schema
export const SearchQuerySchema = z.object({
  q: z.string().max(500).transform(val => val.trim()),
});

// Search result item schema.
//
// familyId is nullable: a child or mother can exist with no family, and a person
// never has one.
export const SearchResultItemSchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(['family', 'mother', 'child', 'person']),
  name: z.string().nullable(),
  familyId: z.number().int().positive().nullable(),
  familyName: z.string().nullable(),
  communityId: z.number().int().positive().nullable(),
  activeEnrollments: z.number().int().default(0),
  relevanceScore: z.number().min(0).max(1).optional(), // For future relevance ranking
});

// Search response schema
export const SearchResponseSchema = z.object({
  results: z.array(SearchResultItemSchema),
  total: z.number().int().min(0),
  query: z.string(),
});

// Inferred types for TypeScript
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
