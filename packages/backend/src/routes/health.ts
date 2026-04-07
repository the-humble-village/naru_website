import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ZScoreRequestSchema, type ZScoreResponse } from '@naru/shared';
import {
  ageInDays,
  weightForAge,
  armCircumferenceForAge,
  classifyZScore
} from '@naru/shared';
import { auth } from '../middleware/auth';

const app = new Hono();

/**
 * POST /zscore
 * Compute z-scores from weight, arm circumference, age, and sex
 */
app.post('/zscore', auth, zValidator('json', ZScoreRequestSchema), async (c) => {
  const { weight, armCircumference, birthDate, sex, referenceDate } = c.req.valid('json');

  // Parse dates
  const birthDateObj = new Date(birthDate);
  const refDateObj = referenceDate ? new Date(referenceDate) : new Date();

  // Calculate age in days
  const ageDays = ageInDays(birthDateObj, refDateObj);

  // Compute z-scores
  let weightZScore: number | null = null;
  let armCircumferenceZScore: number | null = null;

  if (ageDays !== null) {
    // Weight for age z-score (weight is in grams, function expects kg)
    const weightKg = weight / 1000;
    weightZScore = weightForAge(weightKg, ageDays, sex);

    // Arm circumference for age z-score (if provided, convert mm to cm)
    if (armCircumference !== undefined) {
      const circumferenceCm = armCircumference / 10;
      armCircumferenceZScore = armCircumferenceForAge(circumferenceCm, ageDays, sex);
    }
  }

  // Build response
  const response: ZScoreResponse = {
    ageInDays: ageDays,
    weightForAge: {
      value: weightZScore,
      classification: weightZScore !== null ? classifyZScore(weightZScore) : null,
    },
    armCircumferenceForAge: {
      value: armCircumferenceZScore,
      classification: armCircumferenceZScore !== null ? classifyZScore(armCircumferenceZScore) : null,
    },
  };

  return c.json(response);
});

export default app;