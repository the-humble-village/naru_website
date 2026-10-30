import React from 'react';
import { DirectoryHeader } from '../../components/people/PeopleDirectory';
import { useFamilyTable } from './useFamilyTable';
import { FamiliesTable } from './FamiliesTable';
import { useTranslation } from '../../hooks';

export const FamiliesPage: React.FC = () => {
  const table = useFamilyTable();
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-screen-2xl py-1">
      <DirectoryHeader title={t('nav.families')} description={t('directory.families_description')}
        action={{ to: '/families/new', label: t('add_family.title') }} />
      <FamiliesTable table={table} />
    </div>
  );
};

export default FamiliesPage;
