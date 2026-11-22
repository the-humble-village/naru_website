import { describe, it, expect } from 'vitest';
import { toDateTimeLocal, fromDateTimeLocal, nowDateTimeLocal } from '../datetime';

describe('datetime-local helpers', () => {
  describe('toDateTimeLocal', () => {
    it('formats a timestamp as local wall-clock time', () => {
      const date = new Date(2026, 7, 1, 9, 5); // 1 Aug 2026, 09:05 local
      expect(toDateTimeLocal(date)).toBe('2026-08-01T09:05');
    });

    it('zero-pads month, day, hour and minute', () => {
      expect(toDateTimeLocal(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
    });

    it('accepts an ISO string', () => {
      const iso = new Date(2026, 7, 1, 14, 30).toISOString();
      expect(toDateTimeLocal(iso)).toBe('2026-08-01T14:30');
    });

    it('returns empty string for missing or unparseable values', () => {
      expect(toDateTimeLocal(null)).toBe('');
      expect(toDateTimeLocal(undefined)).toBe('');
      expect(toDateTimeLocal('')).toBe('');
      expect(toDateTimeLocal('not a date')).toBe('');
    });
  });

  describe('fromDateTimeLocal', () => {
    it('interprets the value as local time and returns UTC ISO', () => {
      const expected = new Date(2026, 7, 1, 9, 5).toISOString();
      expect(fromDateTimeLocal('2026-08-01T09:05')).toBe(expected);
    });

    it('returns empty string for missing or unparseable values', () => {
      expect(fromDateTimeLocal('')).toBe('');
      expect(fromDateTimeLocal('nonsense')).toBe('');
    });
  });

  describe('round trip', () => {
    // This is the regression the helpers exist for: the old
    // `toISOString().slice(0, 16)` idiom shifted the timestamp by the local UTC
    // offset on every save, so a visit date crept forward each time it was edited.
    it('is stable across repeated edit/save cycles', () => {
      const original = new Date(2026, 7, 1, 9, 5).toISOString();

      let value = original;
      for (let i = 0; i < 5; i++) {
        value = fromDateTimeLocal(toDateTimeLocal(value));
      }

      expect(value).toBe(original);
    });

    it('preserves the wall-clock time the user typed', () => {
      const typed = '2026-12-25T23:59';
      expect(toDateTimeLocal(fromDateTimeLocal(typed))).toBe(typed);
    });
  });

  describe('nowDateTimeLocal', () => {
    it('returns a well-formed datetime-local value', () => {
      expect(nowDateTimeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    it('matches the current local wall clock, not UTC', () => {
      const now = new Date();
      expect(nowDateTimeLocal()).toBe(toDateTimeLocal(now));
      expect(nowDateTimeLocal().slice(11, 13)).toBe(String(now.getHours()).padStart(2, '0'));
    });
  });
});
