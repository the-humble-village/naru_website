import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns2 } from 'lucide-react';
import { type FamilyListItem, type TranslationKey } from '@naru/shared';
import { useTranslation } from '../../hooks';
import { DirectoryFilters, DirectoryPanel, DirectoryTable, DirectoryNameLink, DirectoryPagination, directoryCount, DIRECTORY_FOCUS, type DirectoryColumn } from '../../components/people/PeopleDirectory';
import { formatDate } from '../../utils/datetime';
import { ALL_COLUMNS, SORTABLE, type ColumnKey, type SortColumn, type FamilyTableState } from './useFamilyTable';

function renderCell(
  colKey: ColumnKey,
  family: FamilyListItem,
  communityLookup: Record<number, string>,
  siteLookup: Record<number, string>,
  t: (key: TranslationKey) => string
): React.ReactNode {
  switch (colKey) {
    case 'familyName':
      return <div className="text-sm font-medium text-hv-charcoal">{family.familyName || 'Unnamed Family'}</div>;
    case 'community':
      return (
        <div className="text-sm text-hv-charcoal">
          {family.communityId ? communityLookup[family.communityId] ?? t('common.unknown') : t('family.none')}
        </div>
      );
    case 'site':
      return (
        <div className="text-sm text-hv-charcoal">
          {family.siteId ? siteLookup[family.siteId] ?? t('common.unknown') : t('family.none')}
        </div>
      );
    case 'inCrisis':
      return family.inCrisis ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          {t('families.col_crisis')}
        </span>
      ) : (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {t('families.stable')}
        </span>
      );
    case 'notes':
      return (
        <div className="text-sm text-hv-charcoal truncate max-w-xs" title={family.notes ?? undefined}>
          {family.notes || '—'}
        </div>
      );
    case 'lastVisitDate':
      return (
        <div className="text-sm text-hv-charcoal">
          {family.lastVisitDate ? formatDate(family.lastVisitDate) : '—'}
        </div>
      );
    case 'updatedAt':
      return <div className="text-sm text-hv-charcoal">{formatDate(family.updatedAt)}</div>;
  }
}

interface FamiliesTableProps { table: FamilyTableState }

export const FamiliesTable: React.FC<FamiliesTableProps> = ({ table }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    searchTerm, setSearchTerm, selectedCommunityId, setSelectedCommunityId,
    selectedSiteId, setSelectedSiteId, inCrisisFilter, setInCrisisFilter,
    currentPage, setCurrentPage, pageSize, sortColumn, sortDirection, handleSort,
    visibleColumns, columnWidths, showColumnPicker, setShowColumnPicker,
    columnPickerRef, activeColumns, toggleColumn, handleResizeMouseDown,
    communities, communitiesLoading, communityLookup, sites, sitesLoading, siteLookup,
    families, familiesLoading, isError, error, totalFamilies, totalPages, handleFilterChange,
  } = table;
  const nameLink = (family: FamilyListItem) => (
    <DirectoryNameLink to={`/families/${family.id}`}>{family.familyName || t('directory.unnamed_family')}</DirectoryNameLink>
  );
  const columns: DirectoryColumn<FamilyListItem>[] = activeColumns.map(column => {
    const sortable = SORTABLE.has(column.key);
    const sorted = sortColumn === column.key;
    return {
      key: column.key === 'familyName' ? 'name' : column.key,
      label: t(column.labelKey),
      style: { width: columnWidths[column.key], minWidth: 60 },
      ariaSort: sorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined,
      header: (
        <>
          {sortable ? (
            <button type="button" onClick={() => handleSort(column.key as SortColumn)}
              className={`inline-flex items-center gap-1 rounded pr-2 text-left uppercase ${DIRECTORY_FOCUS}`}>
              {t(column.labelKey)}<span aria-hidden="true" className="text-hv-gray">{sorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </button>
          ) : t(column.labelKey)}
          <div aria-hidden="true" className="absolute right-0 top-0 hidden h-full w-3 cursor-col-resize hover:bg-hv-green/10 md:block"
            onMouseDown={event => handleResizeMouseDown(event, column.key)} />
        </>
      ),
      render: family => column.key === 'familyName' ? nameLink(family) : renderCell(column.key, family, communityLookup, siteLookup, t),
    };
  });
  const showing = t('roster.showing')
    .replace('{from}', String(families.length ? (currentPage - 1) * pageSize + 1 : 0))
    .replace('{to}', String((currentPage - 1) * pageSize + families.length))
    .replace('{total}', String(totalFamilies));
  const columnPicker = (
    <div className="relative" ref={columnPickerRef} onKeyDown={event => {
      if (event.key === 'Escape') {
        setShowColumnPicker(false);
        columnPickerRef.current?.querySelector('button')?.focus();
      }
    }}>
      <button type="button" aria-expanded={showColumnPicker} onClick={() => setShowColumnPicker(value => !value)}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-hv-border px-3 text-sm text-hv-green hover:bg-[#eaf0e9] ${DIRECTORY_FOCUS}`}>
        <Columns2 size={16} aria-hidden="true" />{t('families.columns')}
      </button>
      {showColumnPicker && (
        <fieldset className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-hv-border bg-white p-3 shadow-lg">
          <legend className="sr-only">{t('families.toggle_columns')}</legend>
          <p className="mb-2 text-xs font-semibold uppercase text-hv-green">{t('families.toggle_columns')}</p>
          {ALL_COLUMNS.map(column => (
            <label key={column.key} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm text-hv-charcoal hover:bg-[#eaf0e9]">
              <input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => toggleColumn(column.key)}
                className={`h-4 w-4 accent-hv-green ${DIRECTORY_FOCUS}`} />{t(column.labelKey)}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );

  return (
    <>
      <DirectoryFilters search={searchTerm} searchLabel={t('families.search_families')} searchPlaceholder={t('families.search_by_name')}
        onSearchChange={value => { setSearchTerm(value); handleFilterChange(); }}
        value={{ siteId: selectedSiteId || null, communityId: selectedCommunityId || null }}
        onChange={value => {
          const nextSite = value.siteId ?? '';
          const communityValid = !nextSite || communities.find(community => community.id === value.communityId)?.siteId === nextSite;
          setSelectedSiteId(nextSite);
          setSelectedCommunityId(communityValid ? value.communityId ?? '' : '');
          handleFilterChange();
        }}
        sites={sites} communities={communities.filter(community => !selectedSiteId || community.siteId === selectedSiteId)}
        sitesLoading={sitesLoading} communitiesLoading={communitiesLoading}
        extraActive={inCrisisFilter !== ''}
        onClear={() => { setSearchTerm(''); setSelectedSiteId(''); setSelectedCommunityId(''); setInCrisisFilter(''); handleFilterChange(); }}
        extra={
          <div>
            <span className="mb-1.5 block text-sm font-medium text-hv-green">{t('families.crisis_status')}</span>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-hv-charcoal">
              <input type="checkbox" checked={inCrisisFilter === true}
                onChange={event => { setInCrisisFilter(event.target.checked ? true : ''); handleFilterChange(); }}
                className={`h-4 w-4 accent-hv-green ${DIRECTORY_FOCUS}`} />{t('families.col_crisis')}
            </label>
          </div>
        } />
      <DirectoryPanel title={familiesLoading || isError ? t('nav.families') : directoryCount(t, 'families', totalFamilies)} toolbar={columnPicker}>
        {familiesLoading ? (
          <div className="py-8 text-center text-hv-gray">Loading families...</div>
        ) : isError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-hv-crisis">
            Error loading families: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : (
          <>
            {families.length === 0 ? <div className="py-8 text-center text-hv-gray">{t('families.none_matching')}</div> : (
              <DirectoryTable rows={families} columns={columns} rowKey={family => family.id} rowTitle={nameLink} label={t('nav.families')}
                onRowClick={family => navigate(`/families/${family.id}`)} />
            )}
            <DirectoryPagination page={currentPage - 1} totalPages={Math.max(1, totalPages)} onPageChange={page => setCurrentPage(page + 1)} resultText={showing} />
          </>
        )}
      </DirectoryPanel>
    </>
  );
};

export default FamiliesTable;
