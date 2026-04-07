import { en } from './en.js';
import { es } from './es.js';

// Type for translation keys (derived from English translations)
type TranslationKey = keyof typeof en;

// Type for supported languages
type Language = 'en' | 'es';

// Translation dictionaries
const translations = {
  en,
  es,
} as const;

/**
 * Translation function that returns localized strings
 * @param key - Translation key (e.g., 'nav.dashboard')
 * @param lang - Language code ('en' | 'es')
 * @returns Translated string or the key if translation is not found
 */
export function t(key: TranslationKey, lang: Language = 'en'): string {
  const translation = translations[lang]?.[key];
  if (translation) {
    return translation;
  }

  // Fallback to English if translation not found in specified language
  if (lang !== 'en') {
    const fallback = translations.en[key];
    if (fallback) {
      return fallback;
    }
  }

  // If no translation found, return the key itself
  return key;
}

// Export translation dictionaries for direct use if needed
export { en, es };

// Export types for external use
export type { TranslationKey, Language };