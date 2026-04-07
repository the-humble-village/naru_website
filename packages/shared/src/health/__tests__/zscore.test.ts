import { describe, it, expect } from 'vitest';
import { ageInDays, weightForAge, armCircumferenceForAge, classifyZScore } from '../zscore';

describe('Z-Score Calculator', () => {
  describe('ageInDays', () => {
    it('should calculate age in days correctly', () => {
      const birthDate = new Date('2024-01-01');
      const referenceDate = new Date('2024-01-31');
      expect(ageInDays(birthDate, referenceDate)).toBe(30);
    });

    it('should return null for invalid birth date', () => {
      const invalidDate = new Date('invalid');
      const referenceDate = new Date('2024-01-31');
      expect(ageInDays(invalidDate, referenceDate)).toBeNull();
    });

    it('should return null for negative age', () => {
      const birthDate = new Date('2024-01-31');
      const referenceDate = new Date('2024-01-01');
      expect(ageInDays(birthDate, referenceDate)).toBeNull();
    });

    it('should use current date if no reference date provided', () => {
      const birthDate = new Date();
      birthDate.setDate(birthDate.getDate() - 100); // 100 days ago
      const age = ageInDays(birthDate);
      expect(age).toBe(100);
    });
  });

  describe('weightForAge', () => {
    it('should calculate weight-for-age z-score for male newborn', () => {
      // Test with day 0 male, 3.3kg (close to median)
      const zscore = weightForAge(3.3, 0, 'MALE');
      expect(zscore).toBeCloseTo(-0.1, 1); // Should be close to 0 since weight is near median
    });

    it('should calculate weight-for-age z-score for female newborn', () => {
      // Test with day 0 female, weight close to median
      const zscore = weightForAge(3.2, 0, 'FEMALE');
      expect(zscore).toBeCloseTo(-0.1, 1);
    });

    it('should return null for invalid weight', () => {
      expect(weightForAge(0, 100, 'MALE')).toBeNull();
      expect(weightForAge(-1, 100, 'MALE')).toBeNull();
    });

    it('should return null for age out of range', () => {
      expect(weightForAge(5, 2000, 'MALE')).toBeNull(); // Age beyond table
    });

    it('should calculate correct z-score for 6-month-old', () => {
      // Day 180 (about 6 months)
      const zscore = weightForAge(7.5, 180, 'MALE');
      expect(zscore).toBeDefined();
      expect(typeof zscore).toBe('number');
    });
  });

  describe('armCircumferenceForAge', () => {
    it('should calculate arm circumference z-score for valid age', () => {
      // Day 180 (about 6 months), circumference ~13cm
      const zscore = armCircumferenceForAge(13, 180, 'MALE');
      expect(zscore).toBeDefined();
      expect(typeof zscore).toBe('number');
    });

    it('should return null for age below 91 days (before ACFA starts)', () => {
      const zscore = armCircumferenceForAge(13, 90, 'MALE');
      expect(zscore).toBeNull();
    });

    it('should return null for invalid circumference', () => {
      expect(armCircumferenceForAge(0, 180, 'MALE')).toBeNull();
      expect(armCircumferenceForAge(-1, 180, 'MALE')).toBeNull();
    });

    it('should calculate for both sexes', () => {
      const maleZscore = armCircumferenceForAge(13, 180, 'MALE');
      const femaleZscore = armCircumferenceForAge(13, 180, 'FEMALE');

      expect(maleZscore).toBeDefined();
      expect(femaleZscore).toBeDefined();
      expect(typeof maleZscore).toBe('number');
      expect(typeof femaleZscore).toBe('number');
    });
  });

  describe('classifyZScore', () => {
    it('should classify severe malnutrition', () => {
      expect(classifyZScore(-4)).toBe('severe');
      expect(classifyZScore(-3.5)).toBe('severe');
    });

    it('should classify moderate malnutrition', () => {
      expect(classifyZScore(-2.5)).toBe('moderate');
      expect(classifyZScore(-2.1)).toBe('moderate');
    });

    it('should classify mild malnutrition', () => {
      expect(classifyZScore(-1.5)).toBe('mild');
      expect(classifyZScore(-1.1)).toBe('mild');
    });

    it('should classify normal', () => {
      expect(classifyZScore(0)).toBe('normal');
      expect(classifyZScore(0.5)).toBe('normal');
      expect(classifyZScore(1)).toBe('normal');
    });

    it('should classify above normal', () => {
      expect(classifyZScore(1.5)).toBe('above');
      expect(classifyZScore(2)).toBe('above');
    });

    it('should classify high', () => {
      expect(classifyZScore(2.5)).toBe('high');
      expect(classifyZScore(3)).toBe('high');
    });

    it('should handle boundary values correctly', () => {
      expect(classifyZScore(-3)).toBe('severe');
      expect(classifyZScore(-2.99)).toBe('moderate');
      expect(classifyZScore(-2)).toBe('moderate');
      expect(classifyZScore(-1.99)).toBe('mild');
      expect(classifyZScore(-1)).toBe('mild');
      expect(classifyZScore(-0.99)).toBe('normal');
      expect(classifyZScore(1.01)).toBe('above');
      expect(classifyZScore(2.01)).toBe('high');
    });
  });

  describe('Integration tests with real WHO data', () => {
    it('should handle newborn weight correctly', () => {
      // Test with typical newborn weights
      const maleNewbornNormal = weightForAge(3.3, 0, 'MALE'); // Close to M value
      const femaleNewbornNormal = weightForAge(3.2, 0, 'FEMALE');

      expect(maleNewbornNormal).not.toBeNull();
      expect(femaleNewbornNormal).not.toBeNull();
      expect(Math.abs(maleNewbornNormal!)).toBeLessThan(1); // Should be close to normal
      expect(Math.abs(femaleNewbornNormal!)).toBeLessThan(1);
    });

    it('should detect severe underweight', () => {
      // Very low weight for 6-month-old
      const zscore = weightForAge(4, 180, 'MALE'); // Very low weight at 6 months
      expect(zscore).not.toBeNull();
      expect(zscore!).toBeLessThan(-2); // Should be severely underweight
      expect(classifyZScore(zscore!)).toBe('severe');
    });

    it('should detect overweight', () => {
      // Very high weight for newborn
      const zscore = weightForAge(5, 0, 'MALE'); // Very high weight for newborn
      expect(zscore).not.toBeNull();
      expect(zscore!).toBeGreaterThan(2); // Should be overweight
      expect(classifyZScore(zscore!)).toBe('high');
    });

    it('should handle 1-year-old measurements', () => {
      const oneYearDays = 365;
      const weightZ = weightForAge(9, oneYearDays, 'MALE'); // Typical 1-year weight
      const acfaZ = armCircumferenceForAge(15, oneYearDays, 'MALE'); // Typical 1-year MUAC

      expect(weightZ).not.toBeNull();
      expect(acfaZ).not.toBeNull();
      expect(Math.abs(weightZ!)).toBeLessThan(2); // Should be within normal range
      expect(Math.abs(acfaZ!)).toBeLessThan(2);
    });
  });
});