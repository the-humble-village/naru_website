import React from 'react';
import { Link } from 'react-router-dom';
import { useFamilyTable } from './useFamilyTable';
import { FamiliesTable } from './FamiliesTable';
import { useTranslation } from '../../hooks';

export const FamiliesPage: React.FC = () => {
  const table = useFamilyTable();
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{t('nav.families')}</h1>
        <Link
          to="/families/new"
          className="bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors"
        >
          {t('add_family.title')}
        </Link>
      </div>
      <FamiliesTable table={table} />
    </div>
  );
};

export default FamiliesPage;
