// AI-assisted: see AI-ATTRIBUTION.md
import { z } from 'zod';

/**
 * An English message for a rule, used unless the app installed its own wording
 * with z.config(). The web app does, so it can translate; the API does not.
 */
export const fallbackMessage = (message: string) => (): string | undefined =>
  z.config().customError ? undefined : message;
