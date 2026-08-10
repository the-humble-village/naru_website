import { describe, it, expect } from 'vitest';
import { UserCreateSchema, ParentCreateSchema } from '@naru/shared';
import { parseZodErrors } from '../useFieldErrors';

describe('parseZodErrors', () => {
  it('schema passes for valid data', () => {
    const result = UserCreateSchema.safeParse({
      login: 'alice',
      password: 'secret123456',
      role: 'CASEWORKER',
    });
    expect(result.success).toBe(true);
  });

  it('maps a single field error to its field name', () => {
    const result = UserCreateSchema.safeParse({
      login: '', // fails min(1)
      password: 'secret123456',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = parseZodErrors(result.error);
      expect(errors).toHaveProperty('login');
      expect(typeof errors.login).toBe('string');
    }
  });

  it('maps multiple field errors simultaneously', () => {
    const result = UserCreateSchema.safeParse({
      login: '',      // fails min(1)
      password: 'ab', // fails min(12)
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = parseZodErrors(result.error);
      expect(errors).toHaveProperty('login');
      expect(errors).toHaveProperty('password');
    }
  });

  it('all error values are strings', () => {
    const result = ParentCreateSchema.safeParse({
      firstName: '',
      familyId: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = parseZodErrors(result.error);
      Object.values(errors).forEach((msg) => {
        expect(typeof msg).toBe('string');
      });
    }
  });

  it('only includes fields that actually have errors', () => {
    const result = UserCreateSchema.safeParse({
      login: 'alice',  // valid
      password: 'ab',  // fails min(12)
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = parseZodErrors(result.error);
      expect(errors).not.toHaveProperty('login');
      expect(errors).toHaveProperty('password');
    }
  });
});
