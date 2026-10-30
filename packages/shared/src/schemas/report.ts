import { z } from 'zod';
import { DateOnlySchema, NutritionalStatusEnum, ProgramKindEnum } from './enums.js';

export const REPORT_SLUGS = [
  'census',
  'weight-change',
  'graduations',
  'transitions',
  'newcomers',
  'attendance',
  'visits-by-site',
  'evaluations',
  'home-visits',
  'resources',
  'demographics',
  'incap-pairs',
] as const;

export const ReportSlugEnum = z.enum(REPORT_SLUGS);

// Listed in the index as unavailable rather than omitted, so nobody assumes it
// was forgotten. It needs event attendance (SCHEMA_V2.md §11).
export const DEFERRED_REPORT_SLUGS = ['mobile-clinics'] as const;

export const DeferredReportSlugEnum = z.enum(DEFERRED_REPORT_SLUGS);

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

const OptionalDate = z.preprocess(emptyToUndefined, DateOnlySchema.optional());
const OptionalId = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional()
);

// One filter shape for every report. `siteId` and `communityId` mean the
// subject's home site/community on subject-scoped reports and where the visit
// happened on visit-scoped ones — see report.service.ts.
export const ReportFilterSchema = z.object({
  from: OptionalDate,
  to: OptionalDate,
  siteId: OptionalId,
  programId: OptionalId,
  communityId: OptionalId,
});

// `asOf` is only read by `census`; every other report ignores it.
export const ReportQuerySchema = ReportFilterSchema.extend({
  asOf: OptionalDate,
});

export const ReportColumnTypeEnum = z.enum(['string', 'number', 'date']);

export const ReportColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: ReportColumnTypeEnum,
});

export const ReportCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const ReportRowSchema = z.record(ReportCellSchema);

export const ReportResponseSchema = z.object({
  slug: ReportSlugEnum,
  title: z.string(),
  columns: z.array(ReportColumnSchema),
  rows: z.array(ReportRowSchema),
  total: z.number().int(),
});

export const ReportDescriptorSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  available: z.boolean(),
  note: z.string().nullable(),
  chart: z.enum(['line', 'bar']).nullable(),
});

export const ReportIndexResponseSchema = z.object({
  items: z.array(ReportDescriptorSchema),
  total: z.number().int(),
});

// ── Row shapes, one per report ────────────────────────
//
// Rows travel as untyped cells inside the envelope so one table component can
// render any report; these describe what each report actually puts in them.

export const CensusReportRowSchema = z.object({
  programId: z.number().int(),
  programName: z.string(),
  programKind: ProgramKindEnum,
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  enrolled: z.number().int(),
});

export const WeightChangeReportRowSchema = z.object({
  enrollmentId: z.number().int(),
  subjectName: z.string().nullable(),
  programName: z.string(),
  siteName: z.string().nullable(),
  enrolledAt: DateOnlySchema,
  exitedAt: DateOnlySchema.nullable(),
  entryWeight: z.number().nullable(),
  exitWeight: z.number().nullable(),
  weightChange: z.number().nullable(),
});

export const GraduationsReportRowSchema = z.object({
  enrollmentId: z.number().int(),
  subjectName: z.string().nullable(),
  programName: z.string(),
  siteName: z.string().nullable(),
  enrolledAt: DateOnlySchema,
  exitedAt: DateOnlySchema,
  ageMonthsAtExit: z.number().int().nullable(),
  entryWeight: z.number().nullable(),
  exitWeight: z.number().nullable(),
  weightChange: z.number().nullable(),
});

export const TransitionsReportRowSchema = z.object({
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  fromStatus: NutritionalStatusEnum,
  toStatus: NutritionalStatusEnum,
  transitions: z.number().int(),
});

export const NewcomersReportRowSchema = z.object({
  month: z.string(),
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  newcomers: z.number().int(),
});

export const AttendanceReportRowSchema = z.object({
  programId: z.number().int(),
  programName: z.string(),
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  visits: z.number().int(),
  subjects: z.number().int(),
});

export const VisitsBySiteReportRowSchema = z.object({
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  visits: z.number().int(),
  subjects: z.number().int(),
});

export const EvaluationsReportRowSchema = z.object({
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  evaluations: z.number().int(),
  severe: z.number().int(),
  moderate: z.number().int(),
  mild: z.number().int(),
  normal: z.number().int(),
});

export const HomeVisitsReportRowSchema = z.object({
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  homeVisits: z.number().int(),
  subjects: z.number().int(),
});

export const ResourcesReportRowSchema = z.object({
  resourceId: z.number().int(),
  resourceTitle: z.string(),
  unit: z.string().nullable(),
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  totalQuantity: z.number(),
  visits: z.number().int(),
});

export const DemographicsReportRowSchema = z.object({
  communityId: z.number().int().nullable(),
  communityName: z.string().nullable(),
  siteId: z.number().int().nullable(),
  siteName: z.string().nullable(),
  members: z.number().int(),
  under1: z.number().int(),
  age1to4: z.number().int(),
  age5to14: z.number().int(),
  age15plus: z.number().int(),
  ageUnknown: z.number().int(),
});

export const IncapPairsReportRowSchema = z.object({
  motherId: z.number().int(),
  motherName: z.string(),
  motherProgram: z.string(),
  childId: z.number().int(),
  childName: z.string(),
  childBirthDate: DateOnlySchema,
  childProgram: z.string(),
  communityName: z.string().nullable(),
  siteName: z.string().nullable(),
  childEntryWeight: z.number().nullable(),
  latestStatus: NutritionalStatusEnum.nullable(),
});

export type ReportSlug = z.infer<typeof ReportSlugEnum>;
export type DeferredReportSlug = z.infer<typeof DeferredReportSlugEnum>;
export type ReportFilter = z.infer<typeof ReportFilterSchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
export type ReportColumnType = z.infer<typeof ReportColumnTypeEnum>;
export type ReportColumn = z.infer<typeof ReportColumnSchema>;
export type ReportCell = z.infer<typeof ReportCellSchema>;
export type ReportRow = z.infer<typeof ReportRowSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;
export type ReportDescriptor = z.infer<typeof ReportDescriptorSchema>;
export type ReportIndexResponse = z.infer<typeof ReportIndexResponseSchema>;

export type CensusReportRow = z.infer<typeof CensusReportRowSchema>;
export type WeightChangeReportRow = z.infer<typeof WeightChangeReportRowSchema>;
export type GraduationsReportRow = z.infer<typeof GraduationsReportRowSchema>;
export type TransitionsReportRow = z.infer<typeof TransitionsReportRowSchema>;
export type NewcomersReportRow = z.infer<typeof NewcomersReportRowSchema>;
export type AttendanceReportRow = z.infer<typeof AttendanceReportRowSchema>;
export type VisitsBySiteReportRow = z.infer<typeof VisitsBySiteReportRowSchema>;
export type EvaluationsReportRow = z.infer<typeof EvaluationsReportRowSchema>;
export type HomeVisitsReportRow = z.infer<typeof HomeVisitsReportRowSchema>;
export type ResourcesReportRow = z.infer<typeof ResourcesReportRowSchema>;
export type DemographicsReportRow = z.infer<typeof DemographicsReportRowSchema>;
export type IncapPairsReportRow = z.infer<typeof IncapPairsReportRowSchema>;
