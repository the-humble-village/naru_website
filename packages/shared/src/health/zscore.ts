/**
 * WHO Child Growth Standards Z-Score Calculator
 *
 * Uses the LMS method: Z = ((value / M)^L - 1) / (S * L)
 * Source: https://www.who.int/tools/child-growth-standards
 */

import { WHO_DATA } from './who-data.js';

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