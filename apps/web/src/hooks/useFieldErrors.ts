// AI-assisted: see AI-ATTRIBUTION.md
import { z, ZodError } from 'zod';
import type { TranslationKey } from '@naru/shared';

/**
 * parseZodErrors - Converts a ZodError into a flat Record<string, string> of field errors.
 */
export function parseZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  error.issues.forEach((err) => {
    if (err.path[0]) {
      errors[err.path[0] as string] = err.message;
    }
  });
  return errors;
}

/** The label each visit and enrollment field carries on its form. */
const FIELD_LABELS: Partial<Record<string, TranslationKey>> = {
  visitDate: 'visit.date',
  locationType: 'visit.location_type',
  siteId: 'visit.site',
  communityId: 'visit.community',
  notes: 'visit.notes',
  weight: 'visit.weight_kg',
  gestationMonths: 'visit.gestation_months',
  examinationTypeId: 'visit.examination_type',
  height: 'visit.height_mm',
  armCircumference: 'visit.arm_circumference_mm',
  trainingIds: 'visit.trainings_given',
  resources: 'visit.resources_given',
  answers: 'visit.questions',
  motherId: 'enroll.subject',
  childId: 'enroll.subject',
  personId: 'enroll.subject',
  familyId: 'enroll.subject',
  programId: 'enroll.program',
  enrolledAt: 'enroll.admission_date',
  entryWeight: 'enroll.entry_weight_kg',
  entryPhotoId: 'enroll.entry_photo',
  admissionNotes: 'enroll.admission_notes',
  dueDate: 'enrollment.due_date',
  pregnancyNumber: 'enrollment.pregnancy_number',
  birthingAssistantId: 'enrollment.birthing_assistant',
  lengthAtAdmission: 'enroll.length_mm',
  caretakerName: 'enrollment.caretaker',
  caretakerPhone: 'enrollment.caretaker_phone',
  nutritionalStatus: 'enroll.nutritional_status',
  school: 'enrollment.school',
  classYear: 'enrollment.class_year',
  exitedAt: 'exit.exit_date',
  exitReason: 'exit.reason',
  exitWeight: 'exit.exit_weight_kg',
  exitPhotoId: 'exit.exit_photo',
  exitNotes: 'exit.exit_notes',
};

/**
 * Validate before hitting the network, for forms that show one message for the
 * whole form. Returns the first problem as "Label: message", or null if valid.
 */
export function firstFieldError<T>(
  schema: z.ZodType<T>,
  data: unknown,
  t: (key: TranslationKey) => string
): string | null {
  const issue = schema.safeParse(data).error?.issues[0];
  if (!issue) return null;

  // Innermost first: ['nutritionDetail', 'weight'] is labelled by `weight`.
  const labelKey = [...issue.path]
    .reverse()
    .map((segment) => FIELD_LABELS[String(segment)])
    .find((key) => key !== undefined);

  return labelKey ? `${t(labelKey)}: ${issue.message}` : issue.message;
}
