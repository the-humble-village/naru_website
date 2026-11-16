import { z } from 'zod';

// Guatemalan numbers are eight digits, written 5512-3344. The country code is
// 502, so the international form is +502 5512-3344.
const COUNTRY_CODE = '502';
const LOCAL_DIGITS = 8;
// E.164 caps a full international number at fifteen digits.
const MAX_INTERNATIONAL_DIGITS = 15;

// US/Canada (NANP): +1 then ten digits, written +1 555-010-0199. Only formatted
// behind an explicit +1 — a bare ten-digit number can't be told apart from a
// Guatemalan one until the ninth digit, so it stays capped at eight.
const US_CODE = '1';
const US_DIGITS = 10;

const groupLocal = (digits: string): string =>
  digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;

const groupUs = (digits: string): string =>
  [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join('-');

/**
 * Normalise a phone number as it is typed: drop anything that isn't a digit,
 * cap the length, and insert the separators.
 *
 * - `55123344`         → `5512-3344`
 * - `+50255123344`     → `+502 5512-3344`
 * - `50255123344`      → `+502 5512-3344` (more than eight digits led by 502)
 * - `+1 555 010 0199`  → `+1 555-010-0199`
 * - `+44 20 7946 0958` → `+442079460958` (other countries: digits only)
 *
 * Partial input formats too, and a trailing separator is never added, so
 * backspacing over the dash works.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const international =
    raw.trimStart().startsWith('+') ||
    (digits.length > LOCAL_DIGITS && digits.startsWith(COUNTRY_CODE));

  if (!international) return groupLocal(digits.slice(0, LOCAL_DIGITS));

  const capped = digits.slice(0, MAX_INTERNATIONAL_DIGITS);
  if (capped.startsWith(COUNTRY_CODE) && capped.length > COUNTRY_CODE.length) {
    const local = capped.slice(COUNTRY_CODE.length, COUNTRY_CODE.length + LOCAL_DIGITS);
    return `+${COUNTRY_CODE} ${groupLocal(local)}`;
  }
  if (capped.startsWith(US_CODE) && capped.length > US_CODE.length) {
    return `+${US_CODE} ${groupUs(capped.slice(US_CODE.length, US_CODE.length + US_DIGITS))}`;
  }
  return `+${capped}`;
}

/** Digits, spaces, dashes, parentheses and an optional leading `+` — no letters. */
export const PhoneSchema = z
  .string()
  .max(64)
  .regex(/^\+?[\d\s()-]*$/, 'Phone number may contain only digits');
