import { z } from 'zod';
import { DateOnlySchema, LocationTypeEnum, ProgramKindEnum, SubjectTypeEnum } from './enums.js';
import { FamilyReadSchema } from './family.js';

// A visit row flattened for display: the subject's name and their program,
// resolved through the enrollment so the client needs no follow-up requests.
export const DashboardVisitSchema = z.object({
  id: z.number().int().positive(),
  enrollmentId: z.number().int().positive(),
  visitDate: DateOnlySchema,
  locationType: LocationTypeEnum,
  siteId: z.number().int().nullable(),
  programId: z.number().int().positive(),
  programName: z.string(),
  programKind: ProgramKindEnum,
  subjectType: SubjectTypeEnum,
  subjectId: z.number().int().positive(),
  subjectName: z.string().nullable(),
});

export const DashboardResponseSchema = z.object({
  recentVisits: z.array(DashboardVisitSchema),

  // Active enrollment counts per program — the census the church asks for,
  // measured as of now.
  enrollmentsByProgram: z.array(z.object({
    programId: z.number().int().positive(),
    programName: z.string(),
    programKind: ProgramKindEnum,
    active: z.number().int(),
  })),

  familiesInCrisis: z.array(FamilyReadSchema.extend({
    childrenCount: z.number().int(),
    lastVisitDate: DateOnlySchema.nullable(),
  })),

  stats: z.object({
    activeEnrollments: z.number().int(),
    totalChildren: z.number().int(),
    totalMothers: z.number().int(),
    totalPeople: z.number().int(),
    totalFamilies: z.number().int(),
    totalCommunities: z.number().int(),
    familiesInCrisis: z.number().int(),
    visitsThisMonth: z.number().int(),
    // Subjects with no active enrollment — the shrinking worklist from §9.4.
    unenrolledSubjects: z.number().int(),
  }),

  // Oldest → newest, six months.
  visitsPerMonth: z.array(z.object({
    month: z.string(),
    count: z.number().int(),
  })),

  newcomersPerMonth: z.array(z.object({
    month: z.string(),
    count: z.number().int(),
  })),

  communityBreakdown: z.array(z.object({
    communityId: z.number().int().nullable(),
    families: z.number().int(),
    children: z.number().int(),
    activeEnrollments: z.number().int(),
  })),
});

export type DashboardVisit = z.infer<typeof DashboardVisitSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
