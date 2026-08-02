/**
 * Helpers for `<input type="datetime-local">`.
 *
 * A datetime-local input speaks *local wall-clock time* with no zone: the value
 * `2026-08-01T14:30` means half past two wherever the user is standing. The API
 * speaks UTC ISO strings.
 *
 * The trap is that `new Date(iso).toISOString().slice(0, 16)` looks like it
 * produces an input value but actually produces the UTC wall clock. Feed that
 * into the input and the user sees the wrong time; read it back with
 * `new Date(value).toISOString()` — which parses a zoneless string as *local* —
 * and the timestamp shifts by the UTC offset on every single save. In Guatemala
 * (UTC-6) a visit recorded at 09:00 drifts to 15:00, then 21:00, and so on.
 *
 * Always pair these two functions: `toDateTimeLocal` to fill the input,
 * `fromDateTimeLocal` to read it back.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Format a timestamp as a datetime-local input value ("YYYY-MM-DDTHH:mm") in the
 * user's local timezone. Returns '' for a missing or unparseable value.
 */
export const toDateTimeLocal = (value: string | Date | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

/** The current local time, formatted for a datetime-local input. */
export const nowDateTimeLocal = (): string => toDateTimeLocal(new Date());

/**
 * Convert a datetime-local input value back to a UTC ISO string for the API.
 * Returns '' for an empty or unparseable value, so callers can validate.
 */
export const fromDateTimeLocal = (value: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};
