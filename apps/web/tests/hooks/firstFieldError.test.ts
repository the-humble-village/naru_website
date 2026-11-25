// AI-assisted: see AI-ATTRIBUTION.md
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { en, EnrollmentExitSchema, VisitCreateSchema, type TranslationKey } from '@naru/shared';
import { firstFieldError } from '@/hooks/useFieldErrors';

const t = (key: TranslationKey): string => en[key];
const visit = { enrollmentId: 1, visitDate: '2026-09-01', locationType: 'SITE' };

describe('firstFieldError', () => {
  it('returns null for valid data', () => {
    expect(firstFieldError(VisitCreateSchema, visit, t)).toBeNull();
  });

  it('uses the label from the form', () => {
    const error = firstFieldError(
      EnrollmentExitSchema,
      { exitedAt: '', exitReason: 'GRADUATED' },
      t
    );
    expect(error).toMatch(new RegExp(`^${en['exit.exit_date']}: `));
  });

  it.each([
    ['a nested detail', { pregnancyDetail: { gestationMonths: 20 } }, en['visit.gestation_months']],
    ['a list item', { trainingIds: [-1] }, en['visit.trainings_given']],
  ])('labels %s', (_name, extra, label) => {
    const error = firstFieldError(VisitCreateSchema, { ...visit, ...extra }, t);
    expect(error?.startsWith(`${label}: `)).toBe(true);
  });

  it('shows the message alone for a field with no label', () => {
    const schema = z.object({ other: z.string().min(1, 'Nope') });
    expect(firstFieldError(schema, { other: '' }, t)).toBe('Nope');
  });
});
