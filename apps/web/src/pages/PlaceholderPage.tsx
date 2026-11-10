import React from 'react';
import { Construction } from 'lucide-react';
import { useTranslation } from '../hooks';

export interface PlaceholderPageProps {
  title: string;
  note?: string;
}

/**
 * Stand-in for a V2 route whose page has not been built yet. Keeps the route map
 * complete so navigation, redirects and links can be wired ahead of the pages.
 */
export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, note }) => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold text-hv-charcoal mb-6">{title}</h1>
      <div className="bg-white p-8 rounded-xl border border-hv-border text-center">
        <Construction className="mx-auto mb-3 text-hv-sage" size={28} />
        <p className="text-lg font-semibold text-hv-charcoal">{t('common.coming_soon')}</p>
        <p className="text-sm text-hv-gray mt-1">{note ?? t('common.not_built_yet')}</p>
      </div>
    </div>
  );
};

export default PlaceholderPage;
