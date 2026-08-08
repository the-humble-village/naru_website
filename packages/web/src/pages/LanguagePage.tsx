import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserRead } from '@naru/shared';
import { usersApi } from '../api/users';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';

/**
 * LanguagePage - Language selection and preference setting.
 *
 * The selected language is persisted through PATCH /users/me/language and
 * applied optimistically to the auth store, rolling back if the request fails.
 */
export const LanguagePage: React.FC = () => {
  const { lang, setLanguage, user } = useAuthStore();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState(lang);

  const updateLanguageMutation = useMutation<UserRead, Error, string, { previous: string }>({
    mutationFn: (newLang: string) => usersApi.updateLanguage(newLang),
    onMutate: (newLang) => {
      const previous = lang;
      // Apply immediately so the UI switches without waiting on the round trip.
      setLanguage(newLang);
      return { previous };
    },
    onSuccess: (updated) => {
      setLanguage(updated.lang);
      setSelectedLang(updated.lang);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (_error, _newLang, context) => {
      // Roll the store back to what the server still believes.
      const previous = context?.previous ?? lang;
      setLanguage(previous);
      setSelectedLang(previous);
    },
  });

  const handleLanguageChange = (newLang: string) => {
    updateLanguageMutation.reset();
    setSelectedLang(newLang);
  };

  const handleSave = () => {
    if (selectedLang === lang) {
      return; // No change needed
    }
    updateLanguageMutation.mutate(selectedLang);
  };

  const isSaving = updateLanguageMutation.isPending;

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-hv-charcoal mb-6">{t('lang.title')}</h1>

      <div className="bg-white p-6 rounded-xl border border-hv-border max-w-md">
        <h2 className="text-lg font-serif font-semibold text-hv-charcoal mb-4">{t('lang.label')}</h2>

        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="language"
              value="en"
              disabled={isSaving}
              className="mr-3 text-hv-terracotta focus:ring-hv-terracotta"
              checked={selectedLang === 'en'}
              onChange={() => handleLanguageChange('en')}
            />
            <span>{t('lang.english')}</span>
          </label>

          <label className="flex items-center">
            <input
              type="radio"
              name="language"
              value="es"
              disabled={isSaving}
              className="mr-3 text-hv-terracotta focus:ring-hv-terracotta"
              checked={selectedLang === 'es'}
              onChange={() => handleLanguageChange('es')}
            />
            <span>{t('lang.spanish')}</span>
          </label>
        </div>

        <div className="mt-6 flex flex-col">
          <button
            onClick={handleSave}
            disabled={isSaving || selectedLang === lang}
            className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? t('common.saving') : t('lang.button')}
          </button>

          {updateLanguageMutation.isSuccess && (
            <p className="text-sm mt-2 text-green-600">{t('lang.saved')}</p>
          )}

          {updateLanguageMutation.isError && (
            <p className="text-sm mt-2 text-hv-crisis">
              Failed to save language preference. Please try again.
            </p>
          )}
        </div>

        {user && (
          <div className="mt-4 text-sm text-hv-sage">
            Current user: {user.firstName} {user.lastName} ({user.login})
          </div>
        )}
      </div>
    </div>
  );
};

export default LanguagePage;
