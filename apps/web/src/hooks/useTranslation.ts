import { useMemo } from 'react';
import { t, TranslationKey, Language } from '@naru/shared';
import { useAuthStore } from '../store/auth';

/**
 * Custom hook for translations that integrates with the auth store language setting
 */
export function useTranslation() {
  const { lang } = useAuthStore();

  // Create memoized translation function to avoid re-creating on every render
  const translate = useMemo(() => {
    return (key: TranslationKey): string => {
      return t(key, lang as Language);
    };
  }, [lang]);

  return {
    t: translate,
    lang: lang as Language,
  };
}

export default useTranslation;