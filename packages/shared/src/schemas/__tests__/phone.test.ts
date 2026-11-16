import { describe, expect, it } from 'vitest';
import { formatPhone, PhoneSchema } from '../phone.js';

describe('formatPhone', () => {
  it('groups a local number as XXXX-XXXX', () => {
    expect(formatPhone('55123344')).toBe('5512-3344');
  });

  it('formats partial input without a trailing dash', () => {
    expect(formatPhone('5')).toBe('5');
    expect(formatPhone('5512')).toBe('5512');
    expect(formatPhone('55123')).toBe('5512-3');
  });

  it('lets backspace remove the dash', () => {
    expect(formatPhone('5512-')).toBe('5512');
  });

  it('strips letters and punctuation', () => {
    expect(formatPhone('55ab12-33x44')).toBe('5512-3344');
    expect(formatPhone('abc')).toBe('');
  });

  it('caps a local number at eight digits', () => {
    expect(formatPhone('551233449')).toBe('5512-3344');
  });

  it('formats the Guatemalan country code', () => {
    expect(formatPhone('+50255123344')).toBe('+502 5512-3344');
    expect(formatPhone('+502 5512 3344')).toBe('+502 5512-3344');
    expect(formatPhone('+5025')).toBe('+502 5');
    expect(formatPhone('+502')).toBe('+502');
    expect(formatPhone('+')).toBe('+');
  });

  it('treats a pasted number led by 502 as international', () => {
    expect(formatPhone('50255123344')).toBe('+502 5512-3344');
  });

  it('formats a US number behind +1', () => {
    expect(formatPhone('+1 (555) 010-0199')).toBe('+1 555-010-0199');
    expect(formatPhone('+15550100199')).toBe('+1 555-010-0199');
  });

  it('formats a partial US number without a trailing dash', () => {
    expect(formatPhone('+1')).toBe('+1');
    expect(formatPhone('+15')).toBe('+1 5');
    expect(formatPhone('+1555')).toBe('+1 555');
    expect(formatPhone('+15550')).toBe('+1 555-0');
    expect(formatPhone('+1 555-010-')).toBe('+1 555-010');
  });

  it('caps a US number at ten digits after the +1', () => {
    expect(formatPhone('+155501001999')).toBe('+1 555-010-0199');
  });

  it('does not treat a bare ten-digit number as US', () => {
    expect(formatPhone('5550100199')).toBe('5550-1001');
  });

  it('keeps other countries as digits, capped at fifteen', () => {
    expect(formatPhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(formatPhone('+4434567890123456789')).toBe('+443456789012345');
  });

  it('is idempotent', () => {
    for (const value of ['5512-3344', '+502 5512-3344', '+1 555-010-0199', '+442079460958']) {
      expect(formatPhone(value)).toBe(value);
    }
  });
});

describe('PhoneSchema', () => {
  it('accepts formatted and legacy numbers', () => {
    for (const value of ['5512-3344', '+502 5512-3344', '555-0100', '(502) 5512 3344', '']) {
      expect(PhoneSchema.safeParse(value).success).toBe(true);
    }
  });

  it('rejects letters', () => {
    expect(PhoneSchema.safeParse('5512-abcd').success).toBe(false);
    expect(PhoneSchema.safeParse('call me').success).toBe(false);
  });
});
