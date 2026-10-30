import type { NutritionalStatus, TranslationKey } from '@naru/shared';

// One palette for persisted statuses, live z-score badges, and report charts.
// Normal is neutral so that green specifically identifies mild malnutrition.
export const NUTRITION_STATUS_STYLE: Record<NutritionalStatus, {
  badge: string;
  chart: string;
  label: TranslationKey;
}> = {
  SEVERE: { badge: 'bg-red-100 text-red-800', chart: '#dc2626', label: 'nutritional_status.severe' },
  MODERATE: { badge: 'bg-yellow-100 text-yellow-900', chart: '#eab308', label: 'nutritional_status.moderate' },
  MILD: { badge: 'bg-green-100 text-green-800', chart: '#16a34a', label: 'nutritional_status.mild' },
  NORMAL: { badge: 'bg-slate-100 text-slate-700', chart: '#64748b', label: 'nutritional_status.normal' },
};

export const NUTRITION_STATUS_ORDER: NutritionalStatus[] = ['SEVERE', 'MODERATE', 'MILD', 'NORMAL'];

export const isNutritionStatus = (value: unknown): value is NutritionalStatus =>
  typeof value === 'string' && Object.hasOwn(NUTRITION_STATUS_STYLE, value);
