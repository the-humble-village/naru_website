import { Prisma } from '@prisma/client';
import { HTTPException } from 'hono/http-exception';
import {
  DEFERRED_REPORT_SLUGS,
  REPORT_SLUGS,
  type CensusReportRow,
  type DeferredReportSlug,
  type DemographicsReportRow,
  type EvaluationsReportRow,
  type GraduationsReportRow,
  type HomeVisitsReportRow,
  type IncapPairsReportRow,
  type NewcomersReportRow,
  type NutritionalStatus,
  type ProgramKind,
  type ReportColumn,
  type ReportDescriptor,
  type ReportIndexResponse,
  type ReportQuery,
  type ReportResponse,
  type ReportRow,
  type ReportSlug,
  type ResourcesReportRow,
  type AttendanceReportRow,
  type TransitionsReportRow,
  type VisitsBySiteReportRow,
  type WeightChangeReportRow,
} from '@naru/shared';
import prisma from '../db.js';
import { toDateOnly, toDecimal } from '../utils/date.js';

// ── SQL building blocks ───────────────────────────────

// Raw SQL bypasses the soft-delete middleware, so every table a report touches
// filters `deleted_at IS NULL` itself. A soft-deleted subject makes its LEFT JOIN
// yield NULL, which is why SUBJECT_PRESENT is required alongside this join —
// without it a deleted subject's enrollments would still be counted.
const SUBJECT_JOIN = Prisma.sql`
  LEFT JOIN mothers  subj_m ON subj_m.id = e.mother_id AND subj_m.deleted_at IS NULL
  LEFT JOIN children subj_c ON subj_c.id = e.child_id  AND subj_c.deleted_at IS NULL
  LEFT JOIN people   subj_p ON subj_p.id = e.person_id AND subj_p.deleted_at IS NULL
  LEFT JOIN families subj_f ON subj_f.id = e.family_id AND subj_f.deleted_at IS NULL
  LEFT JOIN communities sc
    ON sc.id = COALESCE(subj_m.community_id, subj_c.community_id, subj_p.community_id, subj_f.community_id)
   AND sc.deleted_at IS NULL
  LEFT JOIN sites ss ON ss.id = sc.site_id AND ss.deleted_at IS NULL
`;

const SUBJECT_PRESENT = Prisma.sql`COALESCE(subj_m.id, subj_c.id, subj_p.id, subj_f.id) IS NOT NULL`;

const SUBJECT_NAME = Prisma.sql`COALESCE(subj_m.name, subj_c.name, subj_p.name, subj_f.family_name)`;

const SUBJECT_BIRTH_DATE = Prisma.sql`COALESCE(subj_m.birth_date, subj_c.birth_date, subj_p.birth_date)`;

const SUBJECT_KEY = Prisma.sql`COALESCE('m' || e.mother_id, 'c' || e.child_id, 'p' || e.person_id, 'f' || e.family_id)`;

const VISIT_JOIN = Prisma.sql`
  JOIN enrollments e ON e.id = v.enrollment_id AND e.deleted_at IS NULL
  JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
  LEFT JOIN sites vs ON vs.id = v.site_id AND vs.deleted_at IS NULL
`;

// `prisma` is typed `any` in db.ts (the soft-delete extension makes the real type
// unwieldy), and TypeScript refuses type arguments on an untyped call. This puts
// the row type back on every raw query in one place.
function rawQuery<T>(sql: Prisma.Sql): Promise<T[]> {
  return prisma.$queryRaw(sql) as Promise<T[]>;
}

function and(conditions: Prisma.Sql[]): Prisma.Sql {
  return conditions.length > 0 ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Filters for a report keyed on the subject's home community and its site. */
function subjectFilters(query: ReportQuery): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (query.programId !== undefined) conditions.push(Prisma.sql`e.program_id = ${query.programId}`);
  if (query.siteId !== undefined) conditions.push(Prisma.sql`sc.site_id = ${query.siteId}`);
  if (query.communityId !== undefined) conditions.push(Prisma.sql`sc.id = ${query.communityId}`);
  return conditions;
}

/** Filters for a report keyed on where the visit happened, which is authoritative. */
function visitFilters(query: ReportQuery): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (query.programId !== undefined) conditions.push(Prisma.sql`e.program_id = ${query.programId}`);
  if (query.siteId !== undefined) conditions.push(Prisma.sql`v.site_id = ${query.siteId}`);
  if (query.communityId !== undefined) conditions.push(Prisma.sql`v.community_id = ${query.communityId}`);
  return conditions;
}

function dateRange(column: Prisma.Sql, query: ReportQuery): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (query.from !== undefined) conditions.push(Prisma.sql`${column} >= ${query.from}::date`);
  if (query.to !== undefined) conditions.push(Prisma.sql`${column} <= ${query.to}::date`);
  return conditions;
}

function weightChange(entry: number | null, exit: number | null): number | null {
  if (entry === null || exit === null) return null;
  return Math.round((exit - entry) * 1000) / 1000;
}

// ── Reports ───────────────────────────────────────────

async function runCensus(query: ReportQuery): Promise<CensusReportRow[]> {
  const asOf = query.asOf ?? query.to ?? today();

  const rows = await rawQuery<{
    program_id: number;
    program_name: string;
    program_kind: ProgramKind;
    site_id: number | null;
    site_name: string | null;
    enrolled: number;
  }>(Prisma.sql`
    SELECT p.id AS program_id, p.name AS program_name, p.kind::text AS program_kind,
           ss.id AS site_id, ss.title AS site_name, COUNT(*)::int AS enrolled
    FROM enrollments e
    JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
    ${SUBJECT_JOIN}
    WHERE e.deleted_at IS NULL
      AND ${SUBJECT_PRESENT}
      AND e.enrolled_at <= ${asOf}::date
      AND (e.exited_at IS NULL OR e.exited_at > ${asOf}::date)
      AND ${and(subjectFilters(query))}
    GROUP BY p.id, p.name, p.kind, ss.id, ss.title
    ORDER BY p.name ASC, ss.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    programId: row.program_id,
    programName: row.program_name,
    programKind: row.program_kind,
    siteId: row.site_id,
    siteName: row.site_name,
    enrolled: row.enrolled,
  }));
}

async function runWeightChange(query: ReportQuery): Promise<WeightChangeReportRow[]> {
  const rows = await rawQuery<{
    enrollment_id: number;
    subject_name: string | null;
    program_name: string;
    site_name: string | null;
    enrolled_at: Date;
    exited_at: Date | null;
    entry_weight: Prisma.Decimal | null;
    exit_weight: Prisma.Decimal | null;
  }>(Prisma.sql`
    SELECT e.id AS enrollment_id, ${SUBJECT_NAME} AS subject_name, p.name AS program_name,
           ss.title AS site_name, e.enrolled_at, e.exited_at, e.entry_weight, e.exit_weight
    FROM enrollments e
    JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
    ${SUBJECT_JOIN}
    WHERE e.deleted_at IS NULL
      AND ${SUBJECT_PRESENT}
      AND (e.entry_weight IS NOT NULL OR e.exit_weight IS NOT NULL)
      AND ${and([...subjectFilters(query), ...dateRange(Prisma.sql`e.enrolled_at`, query)])}
    ORDER BY e.enrolled_at DESC, e.id DESC
  `);

  return rows.map((row) => {
    const entryWeight = toDecimal(row.entry_weight);
    const exitWeight = toDecimal(row.exit_weight);

    return {
      enrollmentId: row.enrollment_id,
      subjectName: row.subject_name,
      programName: row.program_name,
      siteName: row.site_name,
      enrolledAt: toDateOnly(row.enrolled_at)!,
      exitedAt: toDateOnly(row.exited_at),
      entryWeight,
      exitWeight,
      weightChange: weightChange(entryWeight, exitWeight),
    };
  });
}

async function runGraduations(query: ReportQuery): Promise<GraduationsReportRow[]> {
  const rows = await rawQuery<{
    enrollment_id: number;
    subject_name: string | null;
    program_name: string;
    site_name: string | null;
    enrolled_at: Date;
    exited_at: Date;
    age_months_at_exit: number | null;
    entry_weight: Prisma.Decimal | null;
    exit_weight: Prisma.Decimal | null;
  }>(Prisma.sql`
    SELECT e.id AS enrollment_id, ${SUBJECT_NAME} AS subject_name, p.name AS program_name,
           ss.title AS site_name, e.enrolled_at, e.exited_at,
           (EXTRACT(YEAR FROM age(e.exited_at, ${SUBJECT_BIRTH_DATE})) * 12
              + EXTRACT(MONTH FROM age(e.exited_at, ${SUBJECT_BIRTH_DATE})))::int AS age_months_at_exit,
           e.entry_weight, e.exit_weight
    FROM enrollments e
    JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
    ${SUBJECT_JOIN}
    WHERE e.deleted_at IS NULL
      AND ${SUBJECT_PRESENT}
      AND e.exit_reason = 'GRADUATED'
      AND e.exited_at IS NOT NULL
      AND ${and([...subjectFilters(query), ...dateRange(Prisma.sql`e.exited_at`, query)])}
    ORDER BY e.exited_at DESC, e.id DESC
  `);

  return rows.map((row) => {
    const entryWeight = toDecimal(row.entry_weight);
    const exitWeight = toDecimal(row.exit_weight);

    return {
      enrollmentId: row.enrollment_id,
      subjectName: row.subject_name,
      programName: row.program_name,
      siteName: row.site_name,
      enrolledAt: toDateOnly(row.enrolled_at)!,
      exitedAt: toDateOnly(row.exited_at)!,
      ageMonthsAtExit: row.age_months_at_exit,
      entryWeight,
      exitWeight,
      weightChange: weightChange(entryWeight, exitWeight),
    };
  });
}

/**
 * Nutritional-status transitions.
 *
 * LAG puts each visit's status beside the previous visit's status *for the same
 * enrollment*, which is the only way to count a SEVERE→MODERATE move: comparing
 * an enrollment's first status to its last would collapse a child who improved,
 * relapsed and improved again into a single transition, and would miss the
 * relapse entirely. Statuses are grouped by the subject's home site
 * (SCHEMA_V2.md §8), not by where each visit happened.
 */
async function runTransitions(query: ReportQuery): Promise<TransitionsReportRow[]> {
  const rows = await rawQuery<{
    site_id: number | null;
    site_name: string | null;
    from_status: NutritionalStatus;
    to_status: NutritionalStatus;
    transitions: number;
  }>(Prisma.sql`
    WITH statuses AS (
      SELECT ss.id AS site_id, ss.title AS site_name,
             nvd.nutritional_status::text AS status,
             LAG(nvd.nutritional_status::text) OVER (
               PARTITION BY e.id ORDER BY v.visit_date ASC, v.id ASC
             ) AS prev_status
      FROM visits v
      JOIN nutrition_visit_details nvd ON nvd.visit_id = v.id
      JOIN enrollments e ON e.id = v.enrollment_id AND e.deleted_at IS NULL
      JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
      ${SUBJECT_JOIN}
      WHERE v.deleted_at IS NULL
        AND nvd.nutritional_status IS NOT NULL
        AND ${SUBJECT_PRESENT}
        AND ${and([...subjectFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    )
    SELECT site_id, site_name, prev_status AS from_status, status AS to_status,
           COUNT(*)::int AS transitions
    FROM statuses
    WHERE prev_status IS NOT NULL AND prev_status <> status
    GROUP BY site_id, site_name, prev_status, status
    ORDER BY site_name ASC NULLS LAST, from_status ASC, to_status ASC
  `);

  return rows.map((row) => ({
    siteId: row.site_id,
    siteName: row.site_name,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    transitions: row.transitions,
  }));
}

async function runNewcomers(query: ReportQuery): Promise<NewcomersReportRow[]> {
  const rows = await rawQuery<{
    month: string;
    site_id: number | null;
    site_name: string | null;
    newcomers: number;
  }>(Prisma.sql`
    SELECT to_char(date_trunc('month', e.enrolled_at), 'YYYY-MM') AS month,
           ss.id AS site_id, ss.title AS site_name, COUNT(*)::int AS newcomers
    FROM enrollments e
    JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
    ${SUBJECT_JOIN}
    WHERE e.deleted_at IS NULL
      AND ${SUBJECT_PRESENT}
      AND ${and([...subjectFilters(query), ...dateRange(Prisma.sql`e.enrolled_at`, query)])}
    GROUP BY 1, ss.id, ss.title
    ORDER BY 1 ASC, ss.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    month: row.month,
    siteId: row.site_id,
    siteName: row.site_name,
    newcomers: row.newcomers,
  }));
}

async function runAttendance(query: ReportQuery): Promise<AttendanceReportRow[]> {
  const rows = await rawQuery<{
    program_id: number;
    program_name: string;
    site_id: number | null;
    site_name: string | null;
    visits: number;
    subjects: number;
  }>(Prisma.sql`
    SELECT p.id AS program_id, p.name AS program_name, vs.id AS site_id, vs.title AS site_name,
           COUNT(*)::int AS visits, COUNT(DISTINCT ${SUBJECT_KEY})::int AS subjects
    FROM visits v
    ${VISIT_JOIN}
    WHERE v.deleted_at IS NULL
      AND ${and([...visitFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    GROUP BY p.id, p.name, vs.id, vs.title
    ORDER BY p.name ASC, vs.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    programId: row.program_id,
    programName: row.program_name,
    siteId: row.site_id,
    siteName: row.site_name,
    visits: row.visits,
    subjects: row.subjects,
  }));
}

async function runVisitsBySite(query: ReportQuery): Promise<VisitsBySiteReportRow[]> {
  const rows = await rawQuery<{
    site_id: number | null;
    site_name: string | null;
    visits: number;
    subjects: number;
  }>(Prisma.sql`
    SELECT vs.id AS site_id, vs.title AS site_name,
           COUNT(*)::int AS visits, COUNT(DISTINCT ${SUBJECT_KEY})::int AS subjects
    FROM visits v
    ${VISIT_JOIN}
    WHERE v.deleted_at IS NULL
      AND ${and([...visitFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    GROUP BY vs.id, vs.title
    ORDER BY vs.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    siteId: row.site_id,
    siteName: row.site_name,
    visits: row.visits,
    subjects: row.subjects,
  }));
}

async function runEvaluations(query: ReportQuery): Promise<EvaluationsReportRow[]> {
  const rows = await rawQuery<{
    site_id: number | null;
    site_name: string | null;
    evaluations: number;
    severe: number;
    moderate: number;
    mild: number;
    normal: number;
  }>(Prisma.sql`
    SELECT vs.id AS site_id, vs.title AS site_name,
           COUNT(*)::int AS evaluations,
           COUNT(*) FILTER (WHERE nvd.nutritional_status = 'SEVERE')::int AS severe,
           COUNT(*) FILTER (WHERE nvd.nutritional_status = 'MODERATE')::int AS moderate,
           COUNT(*) FILTER (WHERE nvd.nutritional_status = 'MILD')::int AS mild,
           COUNT(*) FILTER (WHERE nvd.nutritional_status = 'NORMAL')::int AS normal
    FROM visits v
    JOIN nutrition_visit_details nvd ON nvd.visit_id = v.id
    ${VISIT_JOIN}
    WHERE v.deleted_at IS NULL
      AND ${and([...visitFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    GROUP BY vs.id, vs.title
    ORDER BY vs.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    siteId: row.site_id,
    siteName: row.site_name,
    evaluations: row.evaluations,
    severe: row.severe,
    moderate: row.moderate,
    mild: row.mild,
    normal: row.normal,
  }));
}

async function runHomeVisits(query: ReportQuery): Promise<HomeVisitsReportRow[]> {
  const rows = await rawQuery<{
    site_id: number | null;
    site_name: string | null;
    home_visits: number;
    subjects: number;
  }>(Prisma.sql`
    SELECT vs.id AS site_id, vs.title AS site_name,
           COUNT(*)::int AS home_visits, COUNT(DISTINCT ${SUBJECT_KEY})::int AS subjects
    FROM visits v
    ${VISIT_JOIN}
    WHERE v.deleted_at IS NULL
      AND v.location_type = 'HOME'
      AND ${and([...visitFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    GROUP BY vs.id, vs.title
    ORDER BY vs.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    siteId: row.site_id,
    siteName: row.site_name,
    homeVisits: row.home_visits,
    subjects: row.subjects,
  }));
}

async function runResources(query: ReportQuery): Promise<ResourcesReportRow[]> {
  const rows = await rawQuery<{
    resource_id: number;
    resource_title: string;
    unit: string | null;
    site_id: number | null;
    site_name: string | null;
    total_quantity: Prisma.Decimal | null;
    visits: number;
  }>(Prisma.sql`
    SELECT r.id AS resource_id, r.title AS resource_title,
           COALESCE(vr.unit, r.default_unit) AS unit,
           vs.id AS site_id, vs.title AS site_name,
           SUM(vr.quantity) AS total_quantity, COUNT(DISTINCT v.id)::int AS visits
    FROM visit_resources vr
    JOIN resources r ON r.id = vr.resource_id AND r.deleted_at IS NULL
    JOIN visits v ON v.id = vr.visit_id AND v.deleted_at IS NULL
    ${VISIT_JOIN}
    WHERE ${and([...visitFilters(query), ...dateRange(Prisma.sql`v.visit_date`, query)])}
    GROUP BY r.id, r.title, COALESCE(vr.unit, r.default_unit), vs.id, vs.title
    ORDER BY r.title ASC, vs.title ASC NULLS LAST
  `);

  return rows.map((row) => ({
    resourceId: row.resource_id,
    resourceTitle: row.resource_title,
    unit: row.unit,
    siteId: row.site_id,
    siteName: row.site_name,
    totalQuantity: toDecimal(row.total_quantity) ?? 0,
    visits: row.visits,
  }));
}

async function runDemographics(query: ReportQuery): Promise<DemographicsReportRow[]> {
  const asOf = query.asOf ?? query.to ?? today();

  const rows = await rawQuery<{
    community_id: number | null;
    community_name: string | null;
    site_id: number | null;
    site_name: string | null;
    members: number;
    under1: number;
    age1to4: number;
    age5to14: number;
    age15plus: number;
    age_unknown: number;
  }>(Prisma.sql`
    WITH members AS (
      SELECT DISTINCT ${SUBJECT_KEY} AS subject_key,
             sc.id AS community_id, sc.title AS community_name,
             ss.id AS site_id, ss.title AS site_name,
             ${SUBJECT_BIRTH_DATE} AS birth_date
      FROM enrollments e
      JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
      ${SUBJECT_JOIN}
      WHERE e.deleted_at IS NULL
        AND ${SUBJECT_PRESENT}
        AND e.enrolled_at <= ${asOf}::date
        AND (e.exited_at IS NULL OR e.exited_at > ${asOf}::date)
        AND ${and(subjectFilters(query))}
    )
    SELECT community_id, community_name, site_id, site_name,
           COUNT(*)::int AS members,
           COUNT(*) FILTER (
             WHERE EXTRACT(YEAR FROM age(${asOf}::date, birth_date)) < 1
           )::int AS under1,
           COUNT(*) FILTER (
             WHERE EXTRACT(YEAR FROM age(${asOf}::date, birth_date)) BETWEEN 1 AND 4
           )::int AS age1to4,
           COUNT(*) FILTER (
             WHERE EXTRACT(YEAR FROM age(${asOf}::date, birth_date)) BETWEEN 5 AND 14
           )::int AS age5to14,
           COUNT(*) FILTER (
             WHERE EXTRACT(YEAR FROM age(${asOf}::date, birth_date)) >= 15
           )::int AS age15plus,
           COUNT(*) FILTER (WHERE birth_date IS NULL)::int AS age_unknown
    FROM members
    GROUP BY community_id, community_name, site_id, site_name
    ORDER BY community_name ASC NULLS LAST
  `);

  return rows.map((row) => ({
    communityId: row.community_id,
    communityName: row.community_name,
    siteId: row.site_id,
    siteName: row.site_name,
    members: row.members,
    under1: row.under1,
    age1to4: row.age1to4,
    age5to14: row.age5to14,
    age15plus: row.age15plus,
    ageUnknown: row.age_unknown,
  }));
}

async function runIncapPairs(query: ReportQuery): Promise<IncapPairsReportRow[]> {
  const childFilters: Prisma.Sql[] = [];
  if (query.programId !== undefined) {
    childFilters.push(Prisma.sql`e.program_id = ${query.programId}`);
  }
  if (query.from !== undefined) childFilters.push(Prisma.sql`e.enrolled_at >= ${query.from}::date`);
  if (query.to !== undefined) childFilters.push(Prisma.sql`e.enrolled_at <= ${query.to}::date`);

  const placeFilters: Prisma.Sql[] = [];
  if (query.siteId !== undefined) placeFilters.push(Prisma.sql`c.site_id = ${query.siteId}`);
  if (query.communityId !== undefined) placeFilters.push(Prisma.sql`c.id = ${query.communityId}`);

  const rows = await rawQuery<{
    mother_id: number;
    mother_name: string;
    mother_program: string;
    child_id: number;
    child_name: string;
    child_birth_date: Date;
    child_program: string;
    community_name: string | null;
    site_name: string | null;
    child_entry_weight: Prisma.Decimal | null;
    latest_status: NutritionalStatus | null;
  }>(Prisma.sql`
    WITH child_enrollment AS (
      SELECT DISTINCT ON (e.child_id)
             e.child_id, e.id AS enrollment_id, e.entry_weight, p.name AS program_name
      FROM enrollments e
      JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
      WHERE e.deleted_at IS NULL AND e.child_id IS NOT NULL
        AND ${and(childFilters)}
      ORDER BY e.child_id, e.enrolled_at DESC, e.id DESC
    ),
    mother_enrollment AS (
      SELECT DISTINCT ON (e.mother_id) e.mother_id, p.name AS program_name
      FROM enrollments e
      JOIN programs p ON p.id = e.program_id AND p.deleted_at IS NULL
      WHERE e.deleted_at IS NULL AND e.mother_id IS NOT NULL
      ORDER BY e.mother_id, e.enrolled_at DESC, e.id DESC
    )
    SELECT m.id AS mother_id, m.name AS mother_name, me.program_name AS mother_program,
           ch.id AS child_id, ch.name AS child_name, ch.birth_date AS child_birth_date,
           ce.program_name AS child_program,
           c.title AS community_name, s.title AS site_name,
           ce.entry_weight AS child_entry_weight,
           latest.nutritional_status::text AS latest_status
    FROM children ch
    JOIN mothers m ON m.id = ch.mother_id AND m.deleted_at IS NULL
    JOIN child_enrollment ce ON ce.child_id = ch.id
    JOIN mother_enrollment me ON me.mother_id = m.id
    LEFT JOIN communities c ON c.id = ch.community_id AND c.deleted_at IS NULL
    LEFT JOIN sites s ON s.id = c.site_id AND s.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT nvd.nutritional_status
      FROM visits v
      JOIN nutrition_visit_details nvd ON nvd.visit_id = v.id
      WHERE v.enrollment_id = ce.enrollment_id
        AND v.deleted_at IS NULL
        AND nvd.nutritional_status IS NOT NULL
      ORDER BY v.visit_date DESC, v.id DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE ch.deleted_at IS NULL
      AND ${and(placeFilters)}
    ORDER BY m.name ASC, ch.name ASC
  `);

  return rows.map((row) => ({
    motherId: row.mother_id,
    motherName: row.mother_name,
    motherProgram: row.mother_program,
    childId: row.child_id,
    childName: row.child_name,
    childBirthDate: toDateOnly(row.child_birth_date)!,
    childProgram: row.child_program,
    communityName: row.community_name,
    siteName: row.site_name,
    childEntryWeight: toDecimal(row.child_entry_weight),
    latestStatus: row.latest_status,
  }));
}

// ── Registry ──────────────────────────────────────────

interface ReportDefinition {
  title: string;
  description: string;
  chart: 'line' | 'bar' | null;
  columns: ReportColumn[];
  run: (query: ReportQuery) => Promise<ReportRow[]>;
}

const text = (key: string, label: string): ReportColumn => ({ key, label, type: 'string' });
const num = (key: string, label: string): ReportColumn => ({ key, label, type: 'number' });
const date = (key: string, label: string): ReportColumn => ({ key, label, type: 'date' });

const DEFINITIONS: Record<ReportSlug, ReportDefinition> = {
  census: {
    title: 'Program census at date',
    description: 'How many subjects were enrolled in each program on a given date, by site.',
    chart: 'line',
    columns: [
      text('programName', 'Program'),
      text('programKind', 'Kind'),
      text('siteName', 'Site'),
      num('enrolled', 'Enrolled'),
    ],
    run: runCensus,
  },
  'weight-change': {
    title: 'Entry vs exit weight',
    description: 'Weight recorded on admission against weight recorded on exit, per enrollment.',
    chart: null,
    columns: [
      text('subjectName', 'Subject'),
      text('programName', 'Program'),
      text('siteName', 'Site'),
      date('enrolledAt', 'Admitted'),
      date('exitedAt', 'Exited'),
      num('entryWeight', 'Entry weight (kg)'),
      num('exitWeight', 'Exit weight (kg)'),
      num('weightChange', 'Change (kg)'),
    ],
    run: runWeightChange,
  },
  graduations: {
    title: 'Graduations',
    description: 'Enrollments that ended in graduation, with weight and age at exit.',
    chart: null,
    columns: [
      text('subjectName', 'Subject'),
      text('programName', 'Program'),
      text('siteName', 'Site'),
      date('enrolledAt', 'Admitted'),
      date('exitedAt', 'Graduated'),
      num('ageMonthsAtExit', 'Age at exit (months)'),
      num('entryWeight', 'Entry weight (kg)'),
      num('exitWeight', 'Exit weight (kg)'),
      num('weightChange', 'Change (kg)'),
    ],
    run: runGraduations,
  },
  transitions: {
    title: 'Nutrition transitions',
    description:
      'Moves between nutritional statuses across consecutive visits, counted per site.',
    chart: 'bar',
    columns: [
      text('siteName', 'Site'),
      text('fromStatus', 'From'),
      text('toStatus', 'To'),
      num('transitions', 'Transitions'),
    ],
    run: runTransitions,
  },
  newcomers: {
    title: 'Newcomers per month',
    description: 'New enrollments per calendar month, by site.',
    chart: 'line',
    columns: [text('month', 'Month'), text('siteName', 'Site'), num('newcomers', 'Newcomers')],
    run: runNewcomers,
  },
  attendance: {
    title: 'Program attendance',
    description: 'Visits recorded per program and site, with the number of distinct subjects seen.',
    chart: null,
    columns: [
      text('programName', 'Program'),
      text('siteName', 'Site'),
      num('visits', 'Visits'),
      num('subjects', 'Subjects'),
    ],
    run: runAttendance,
  },
  'visits-by-site': {
    title: 'Visits per site',
    description: 'Total visits recorded at each site, with the number of distinct subjects seen.',
    chart: null,
    columns: [text('siteName', 'Site'), num('visits', 'Visits'), num('subjects', 'Subjects')],
    run: runVisitsBySite,
  },
  evaluations: {
    title: 'Nutrition evaluations',
    description: 'Nutritional evaluations recorded per site, broken down by status.',
    chart: null,
    columns: [
      text('siteName', 'Site'),
      num('evaluations', 'Evaluations'),
      num('severe', 'Severe'),
      num('moderate', 'Moderate'),
      num('mild', 'Mild'),
      num('normal', 'Normal'),
    ],
    run: runEvaluations,
  },
  'home-visits': {
    title: 'Home visits',
    description: 'Visits recorded in the home, per site.',
    chart: null,
    columns: [text('siteName', 'Site'), num('homeVisits', 'Home visits'), num('subjects', 'Subjects')],
    run: runHomeVisits,
  },
  resources: {
    title: 'Resources distributed',
    description:
      'Quantity of each resource handed out per site — kitchen gardens, chickens, and anything else.',
    chart: null,
    columns: [
      text('resourceTitle', 'Resource'),
      text('unit', 'Unit'),
      text('siteName', 'Site'),
      num('totalQuantity', 'Total'),
      num('visits', 'Visits'),
    ],
    run: runResources,
  },
  demographics: {
    title: 'Members by community and age',
    description: 'Distinct enrolled subjects per community, banded by age.',
    chart: null,
    columns: [
      text('communityName', 'Community'),
      text('siteName', 'Site'),
      num('members', 'Members'),
      num('under1', 'Under 1'),
      num('age1to4', '1–4'),
      num('age5to14', '5–14'),
      num('age15plus', '15+'),
      num('ageUnknown', 'Unknown'),
    ],
    run: runDemographics,
  },
  'incap-pairs': {
    title: 'Mother–infant pairs',
    description: 'Enrolled children linked to their enrolled mother, with the latest status.',
    chart: null,
    columns: [
      text('motherName', 'Mother'),
      text('motherProgram', 'Mother program'),
      text('childName', 'Child'),
      date('childBirthDate', 'Child born'),
      text('childProgram', 'Child program'),
      text('communityName', 'Community'),
      text('siteName', 'Site'),
      num('childEntryWeight', 'Entry weight (kg)'),
      text('latestStatus', 'Latest status'),
    ],
    run: runIncapPairs,
  },
};

const DEFERRED_DESCRIPTORS: Record<
  DeferredReportSlug,
  { title: string; description: string; note: string }
> = {
  'mobile-clinics': {
    title: 'Mobile clinics',
    description: 'How many mobile clinics were held, and how many communities each one reached.',
    note: 'Not available in V1 — it needs event attendance, which is not yet recorded.',
  },
};

// ── Public API ────────────────────────────────────────

export function listReports(): ReportIndexResponse {
  const available: ReportDescriptor[] = REPORT_SLUGS.map((slug) => ({
    slug,
    title: DEFINITIONS[slug].title,
    description: DEFINITIONS[slug].description,
    available: true,
    note: null,
    chart: DEFINITIONS[slug].chart,
  }));

  const deferred: ReportDescriptor[] = DEFERRED_REPORT_SLUGS.map((slug) => ({
    slug,
    title: DEFERRED_DESCRIPTORS[slug].title,
    description: DEFERRED_DESCRIPTORS[slug].description,
    available: false,
    note: DEFERRED_DESCRIPTORS[slug].note,
    chart: null,
  }));

  const items = [...available, ...deferred];
  return { items, total: items.length };
}

export async function runReport(slug: string, query: ReportQuery): Promise<ReportResponse> {
  if ((DEFERRED_REPORT_SLUGS as readonly string[]).includes(slug)) {
    throw new HTTPException(501, {
      message: `The "${slug}" report is not available in V1 — it needs event attendance.`,
    });
  }

  if (!(REPORT_SLUGS as readonly string[]).includes(slug)) {
    throw new HTTPException(404, { message: 'Report not found' });
  }

  const definition = DEFINITIONS[slug as ReportSlug];
  const rows = await definition.run(query);

  return {
    slug: slug as ReportSlug,
    title: definition.title,
    columns: definition.columns,
    rows,
    total: rows.length,
  };
}

/**
 * Render a report as CSV. Takes an already-run report rather than re-querying, so
 * the download and the table on screen can never disagree.
 */
export function toCsv(report: ReportResponse): string {
  const lines = [report.columns.map((column) => escapeCsv(column.label)).join(',')];

  for (const row of report.rows) {
    lines.push(report.columns.map((column) => escapeCsv(row[column.key])).join(','));
  }

  return lines.join('\r\n');
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';

  const cell = String(value);

  return /["\n\r,]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function csvFilename(slug: string): string {
  return `${slug}-${today()}.csv`;
}
