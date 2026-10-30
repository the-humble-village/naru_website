/**
 * WHO Child Growth Standards Z-Score Calculator
 *
 * Uses the LMS method: Z = ((value / M)^L - 1) / (S * L)
 * Source: https://www.who.int/tools/child-growth-standards
 */

import { WHO_DATA } from './who-data.js';
import type { NutritionalStatus, Sex } from '../schemas/enums.js';

/**
 * Calculate the age of a child in days from their birth date to a reference date.
 * @param birthDate The child's birth date
 * @param referenceDate The reference date (defaults to today)
 * @return Age in days, or null if birth date is invalid
 */
export function ageInDays(birthDate: Date, referenceDate?: Date): number | null {
  if (!birthDate || isNaN(birthDate.getTime())) {
    return null;
  }

  const refDate = referenceDate || new Date();
  if (isNaN(refDate.getTime())) {
    return null;
  }

  // Calculate the difference in days, rounding to nearest day to handle time zone issues
  const diffTime = refDate.getTime() - birthDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
}

/**
 * Compute a z-score using the LMS method.
 * @param value The measured value
 * @param lms [L, M, S] parameters for the child's age
 * @return The z-score
 */
function computeZScore(value: number, lms: [number, number, number]): number {
  const [L, M, S] = lms;

  if (L === 0) {
    return Math.log(value / M) / S;
  }

  return (Math.pow(value / M, L) - 1) / (S * L);
}

/**
 * Get LMS parameters for a given age in days and sex.
 * @param table The LMS lookup table
 * @param ageDays Age in days
 * @return [L, M, S] or null if age is out of range
 */
function getLMS(table: Record<number, [number, number, number]>, ageDays: number): [number, number, number] | null {
  if (table[ageDays]) {
    return table[ageDays];
  }
  return null;
}

/**
 * Calculate weight-for-age z-score.
 * @param weightKg Weight in kilograms
 * @param ageDays Age in days
 * @param sex 'MALE' or 'FEMALE' (using enum values from Prisma schema)
 * @return Z-score or null if out of range
 */
export function weightForAge(weightKg: number, ageDays: number, sex: 'MALE' | 'FEMALE'): number | null {
  const table = sex === 'FEMALE' ? WHO_DATA.WFA_GIRLS : WHO_DATA.WFA_BOYS;
  const lms = getLMS(table, ageDays);

  if (lms === null || weightKg <= 0) {
    return null;
  }

  return computeZScore(weightKg, lms);
}

/**
 * Calculate arm-circumference-for-age z-score.
 * @param circumferenceCm Arm circumference in centimeters
 * @param ageDays Age in days
 * @param sex 'MALE' or 'FEMALE' (using enum values from Prisma schema)
 * @return Z-score or null if out of range (requires age >= 91 days)
 */
export function armCircumferenceForAge(circumferenceCm: number, ageDays: number, sex: 'MALE' | 'FEMALE'): number | null {
  const table = sex === 'FEMALE' ? WHO_DATA.ACFA_GIRLS : WHO_DATA.ACFA_BOYS;
  const lms = getLMS(table, ageDays);

  if (lms === null || circumferenceCm <= 0) {
    return null;
  }

  return computeZScore(circumferenceCm, lms);
}

/**
 * Calculate length/height-for-age z-score.
 * @param heightCm Length or height in centimeters
 * @param ageDays Age in days
 * @param sex 'MALE' or 'FEMALE' (using enum values from Prisma schema)
 * @return Z-score or null if out of range
 */
export function heightForAge(heightCm: number, ageDays: number, sex: 'MALE' | 'FEMALE'): number | null {
  const table = sex === 'FEMALE' ? WHO_DATA.LHFA_GIRLS : WHO_DATA.LHFA_BOYS;
  const lms = getLMS(table, ageDays);

  if (lms === null || heightCm <= 0) {
    return null;
  }

  return computeZScore(heightCm, lms);
}

/**
 * Age at which WHO switches from recumbent length to standing height. The two
 * tables are not interchangeable — a child measured lying down reads about
 * 0.7cm longer than the same child standing — so picking the wrong one shifts
 * every weight-for-length z-score in the same direction.
 */
const STANDING_HEIGHT_FROM_DAYS = 731;

/**
 * Calculate weight-for-length/height z-score.
 *
 * Under two years WHO publishes weight-for-length (recumbent, 45-110cm); from
 * two years, weight-for-height (standing, 65-120cm). Both tables here are keyed
 * by millimetres.
 *
 * @param weightKg Weight in kilograms
 * @param heightMm Length or height in millimetres
 * @param ageDays Age in days, which selects the recumbent or standing table
 * @param sex 'MALE' or 'FEMALE' (using enum values from Prisma schema)
 * @return Z-score or null if out of range
 */
export function weightForHeight(
  weightKg: number,
  heightMm: number,
  ageDays: number,
  sex: 'MALE' | 'FEMALE'
): number | null {
  const standing = ageDays >= STANDING_HEIGHT_FROM_DAYS;
  const table = standing
    ? sex === 'FEMALE'
      ? WHO_DATA.WFH_GIRLS
      : WHO_DATA.WFH_BOYS
    : sex === 'FEMALE'
      ? WHO_DATA.WFL_GIRLS
      : WHO_DATA.WFL_BOYS;

  const lms = getLMS(table, Math.round(heightMm));

  if (lms === null || weightKg <= 0) {
    return null;
  }

  return computeZScore(weightKg, lms);
}

/**
 * Get a classification label for a z-score.
 * @param z The z-score
 * @return Classification label
 */
export function classifyZScore(z: number): 'severe' | 'moderate' | 'mild' | 'normal' | 'above' | 'high' {
  if (z <= -3) return 'severe';
  if (z <= -2) return 'moderate';
  if (z <= -1) return 'mild';
  if (z <= 1) return 'normal';
  if (z <= 2) return 'above';
  return 'high';
}

/**
 * Collapse a z-score onto the four-value NutritionalStatus enum.
 *
 * classifyZScore returns six labels; the enum has four. `above` (+1..+2) and
 * `high` (>+2) both become NORMAL: this is a malnutrition programme and nobody
 * is asked to act on an overweight reading. The raw z-scores are persisted
 * alongside the status, so an overweight report stays possible without a
 * migration.
 */
export function toNutritionalStatus(z: number | null | undefined): NutritionalStatus | null {
  if (z === null || z === undefined || !Number.isFinite(z)) return null;

  switch (classifyZScore(z)) {
    case 'severe':
      return 'SEVERE';
    case 'moderate':
      return 'MODERATE';
    case 'mild':
      return 'MILD';
    default:
      return 'NORMAL';
  }
}

/**
 * Measurements in the units the database stores them in — kilograms for weight,
 * millimetres for height and arm circumference. Keeping the conversion inside
 * this module is deliberate: armCircumferenceForAge takes centimetres, and a
 * missed /10 produces a plausible-looking but badly wrong z-score.
 */
export interface NutritionMeasurements {
  weightKg?: number | null;
  heightMm?: number | null;
  armCircumferenceMm?: number | null;
}

export interface NutritionZScores {
  weightForAgeZ: number | null;
  heightForAgeZ: number | null;
  weightForHeightZ: number | null;
  muacZ: number | null;
  nutritionalStatus: NutritionalStatus | null;
}

function round2(z: number | null): number | null {
  return z === null ? null : Math.round(z * 100) / 100;
}

/**
 * Compute every z-score a nutrition visit persists, plus the derived status.
 *
 * The backend calls this at write time and stores the result; the web calls it
 * to render the live badge as a worker types. Both must agree, which is why it
 * lives here rather than in the service.
 *
 * nutritionalStatus follows MUAC-for-age when an arm circumference was taken,
 * falling back to weight-for-age otherwise. MUAC is the WHO measure for the
 * acute malnutrition this programme treats, and it is the one a worker can take
 * with a tape when the scale is unreliable.
 */
export function computeNutritionZScores(
  measurements: NutritionMeasurements,
  ageDays: number | null,
  sex: Sex
): NutritionZScores {
  const { weightKg, heightMm, armCircumferenceMm } = measurements;

  const hasWeight = weightKg !== null && weightKg !== undefined;
  const hasHeight = heightMm !== null && heightMm !== undefined;

  const weightForAgeZ =
    ageDays !== null && hasWeight ? round2(weightForAge(weightKg, ageDays, sex)) : null;

  const heightForAgeZ =
    ageDays !== null && hasHeight ? round2(heightForAge(heightMm / 10, ageDays, sex)) : null;

  const weightForHeightZ =
    ageDays !== null && hasWeight && hasHeight
      ? round2(weightForHeight(weightKg, heightMm, ageDays, sex))
      : null;

  const muacZ =
    ageDays !== null && armCircumferenceMm !== null && armCircumferenceMm !== undefined
      ? round2(armCircumferenceForAge(armCircumferenceMm / 10, ageDays, sex))
      : null;

  return {
    weightForAgeZ,
    heightForAgeZ,
    weightForHeightZ,
    muacZ,
    nutritionalStatus: toNutritionalStatus(muacZ ?? weightForAgeZ),
  };
}