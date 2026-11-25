// AI-assisted: see AI-ATTRIBUTION.md
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { DateOnlySchema, en, es, EventCreateSchema, LoginSchema, PhoneSchema } from '@naru/shared';
import { parseZodErrors } from '@/hooks/useFieldErrors';
import { installValidationMessages } from '@/utils/validationMessages';

const messageFor = (schema: z.ZodType, value: unknown): string | undefined =>
  schema.safeParse(value).error?.issues[0]?.message;

describe('validation messages', () => {
  let lang: string;

  beforeEach(() => {
    lang = 'en';
    installValidationMessages(() => lang);
  });

  afterEach(() => {
    z.config({ customError: undefined });
  });

  it.each([
    ['a blank string', z.string().min(1), '', en['validation.required']],
    ['a missing value', z.number(), null, en['validation.required']],
    ['a blank choice', z.enum(['A']), '', en['validation.required']],
    ['a short string', z.string().min(12), 'abc', en['validation.too_short'].replace('{min}', '12')],
    ['a long string', z.string().max(2), 'abc', en['validation.too_long'].replace('{max}', '2')],
    ['a small number', z.number().min(0), -1, en['validation.number_too_small'].replace('{min}', '0')],
    ['a large number', z.number().max(11), 12, en['validation.number_too_big'].replace('{max}', '11')],
    ['a bad email', z.string().email(), 'nope', en['validation.invalid_email']],
    ['a bad date', DateOnlySchema, 'soon', en['validation.invalid_date']],
    ['a bad phone number', PhoneSchema, 'call me', en['validation.invalid_phone']],
    ['anything else', z.number(), 'abc', en['validation.invalid']],
  ])('explains %s', (_name, schema, value, expected) => {
    expect(messageFor(schema, value)).toBe(expected);
  });

  it('follows the current language', () => {
    lang = 'es';
    expect(messageFor(z.string().min(1), '')).toBe(es['validation.required']);
  });

  it('keeps a message written into a schema', () => {
    expect(messageFor(z.string().min(1, 'Own message'), '')).toBe('Own message');
  });

  it('leaves the fallback messages in place when nothing is installed', () => {
    z.config({ customError: undefined });
    expect(messageFor(DateOnlySchema, '')).toBe('Expected YYYY-MM-DD');
    expect(messageFor(PhoneSchema, 'call me')).toBe('Phone number may contain only digits');
  });

  it('applies to the shared schemas', () => {
    const login = LoginSchema.safeParse({ login: '', password: '' });
    expect(parseZodErrors(login.error!)).toEqual({
      login: en['validation.required'],
      password: en['validation.required'],
    });

    const event = EventCreateSchema.safeParse({ name: 'Fair', eventDate: '', notes: null });
    expect(parseZodErrors(event.error!)).toEqual({ eventDate: en['validation.required'] });
  });
});
