import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useTranslation } from '../hooks/useTranslation';

/**
 * LanguagePage - Language selection and preference setting
 */
export const LanguagePage: React.FC = () => {
  const { lang, setLanguage, user } = useAuthStore();
  const { t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(lang);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleLanguageChange = (newLang: string) => {
    setSelectedLang(newLang);
  };

  const handleSave = async () => {
    if (selectedLang === lang) {
      return; // No change needed
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      // Update local state immediately for better UX
      setLanguage(selectedLang);

      // TODO: Make API call to save language preference to backend
      // This would be implemented when the user language update endpoint is available
      // await api.updateUserLanguage(selectedLang);

      setSaveMessage(t('lang.saved'));
    } catch (error) {
      console.error('Failed to save language preference:', error);
      // Revert local change on error
      setLanguage(lang);
      setSelectedLang(lang);
      setSaveMessage('Failed to save language preference. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
            {isSaving ? 'Saving...' : t('lang.button')}
          </button>

          {saveMessage && (
            <p className="text-sm mt-2 text-green-600">{saveMessage}</p>
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