import { ZodError } from 'zod';

/**
 * parseZodErrors - Converts a ZodError into a flat Record<string, string> of field errors.
 */
export function parseZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  error.errors.forEach((err) => {
    if (err.path[0]) {
      errors[err.path[0] as string] = err.message;
    }
  });
  return errors;
}
