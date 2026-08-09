import { z } from 'zod';
import { FamilyReadSchema } from './family.js';
import { ChildReadSchema } from './child.js';
import { ChildVisitReadSchema } from './child-visit.js';
import { FamilyVisitReadSchema } from './family-visit.js';
import { ParentReadSchema } from './parent.js';
import { ParentVisitReadSchema } from './parent-visit.js';

// Dashboard response schema
export const DashboardResponseSchema = z.object({
  // Recent visits (child, family and parent visits combined)
  recentVisits: z.object({
    childVisits: z.array(ChildVisitReadSchema.extend({
      child: ChildReadSchema.pick({ id: true, name: true, familyId: true }),
    })),
    familyVisits: z.array(FamilyVisitReadSchema.extend({
      family: FamilyReadSchema.pick({ id: true, familyName: true }),
    })),
    parentVisits: z.array(ParentVisitReadSchema.extend({
      parent: ParentReadSchema.pick({ id: true, name: true, familyId: true }),
    })).default([]),
  }),

  // Recently updated children (with latest measurements)
  recentlyUpdatedChildren: z.array(ChildReadSchema.extend({
    family: FamilyReadSchema.pick({ id: true, familyName: true }),
    latestVisit: ChildVisitReadSchema.pick({
      id: true,
      visitDate: true,
      weight: true,
      height: true,
      armCircumference: true,
    }).nullable(),
  })),

  // Families currently in crisis
  familiesInCrisis: z.array(FamilyReadSchema.extend({
    childrenCount: z.number().int(),
    lastVisitDate: z.string().datetime().nullable(),
  })),

  // Summary statistics
  stats: z.object({
    totalFamilies: z.number().int(),
    totalChildren: z.number().int(),
    totalCommunities: z.number().int().default(0),
    familiesInCrisis: z.number().int(),
    visitsThisMonth: z.number().int(),
  }),

  // Monthly visit counts for the past 6 months (oldest → newest)
  visitsPerMonth: z.array(z.object({
    month: z.string(),   // e.g. "Jan", "Feb"
    count: z.number().int(),
  })),

  // Families and children broken down by community
  communityBreakdown: z.array(z.object({
    communityId: z.number().int().nullable(),
    families: z.number().int(),
    children: z.number().int(),
  })),
});

// Inferred types for TypeScript
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;