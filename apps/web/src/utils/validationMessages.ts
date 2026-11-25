// AI-assisted: see AI-ATTRIBUTION.md
import { z } from 'zod';
import { DATE_ONLY_PATTERN, PHONE_PATTERN, t, type Language } from '@naru/shared';

/**
 * Replace Zod's default messages ("Too small: expected string to have >=1
 * characters") with sentences fit to show in a form, in the user's language.
 *
 * Set once for the whole app. A message written into a schema still wins, unless
 * the schema used fallbackMessage().
 */
export function installValidationMessages(getLanguage: () => string): void {
  z.config({
    customError: (issue) => {
      const lang = getLanguage() as Language;
      const { input } = issue;

      if (input === undefined || input === null || input === '') {
        return t('validation.required', lang);
      }

      if (issue.code === 'too_small') {
        const min = String(issue.minimum);
        if (issue.origin === 'string') return t('validation.too_short', lang).replace('{min}', min);
        if (issue.origin === 'number' && issue.inclusive) {
          return t('validation.number_too_small', lang).replace('{min}', min);
        }
      }

      if (issue.code === 'too_big') {
        const max = String(issue.maximum);
        if (issue.origin === 'string') return t('validation.too_long', lang).replace('{max}', max);
        if (issue.origin === 'number' && issue.inclusive) {
          return t('validation.number_too_big', lang).replace('{max}', max);
        }
      }

      if (issue.code === 'invalid_format') {
        if (issue.format === 'email') return t('validation.invalid_email', lang);
        if (issue.format === 'datetime' || issue.pattern === String(DATE_ONLY_PATTERN)) {
          return t('validation.invalid_date', lang);
        }
        if (issue.pattern === String(PHONE_PATTERN)) return t('validation.invalid_phone', lang);
      }

      return t('validation.invalid', lang);
    },
  });
}
