import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Columns2 } from 'lucide-react';
import { type FamilyListItem, type TranslationKey } from '@naru/shared';
import { useTranslation } from '../../hooks';
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
    case 'childrenEditable':
      return <div className="text-sm text-hv-charcoal">{family.childrenEditable}</div>;
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

interface FamiliesTableProps {
  table: FamilyTableState;
  highlightCrisis?: boolean;
  compact?: boolean;
}

export const FamiliesTable: React.FC<FamiliesTableProps> = ({
  table,
  highlightCrisis = false,
  compact = false,
}) => {
  const { t } = useTranslation();
  const {
    searchTerm, setSearchTerm,
    selectedCommunityId, setSelectedCommunityId,
    selectedSiteId, setSelectedSiteId,
    inCrisisFilter, setInCrisisFilter,
    currentPage, setCurrentPage,
    pageSize,
    sortColumn, sortDirection, handleSort,
    visibleColumns, columnWidths, showColumnPicker, setShowColumnPicker,
    columnPickerRef, activeColumns, toggleColumn,
    handleResizeMouseDown,
    communities, communitiesLoading,
    communityLookup,
    sites, sitesLoading,
    siteLookup,
    families, familiesLoading, isError, error,
    totalFamilies, totalPages,
    handleFilterChange,
  } = table;

  const navigate = useNavigate();
  const labelClass = `block ${compact ? 'text-xs' : 'text-sm'} font-medium text-hv-charcoal mb-1`;
  const inputClass = `w-full px-3 py-2 ${compact ? 'text-sm' : ''} border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent`;

  return (
    <div>
      {/* Filters */}
      <div className={`bg-white ${compact ? 'p-4 mb-4' : 'p-6 mb-6'} rounded-xl border border-hv-border`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label htmlFor="fam-search" className={labelClass}>{t('families.search_families')}</label>
            <input
              id="fam-search"
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
              placeholder={t('families.search_by_name')}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="fam-site" className={labelClass}>{t('families.col_site')}</label>
            <select
              id="fam-site"
              value={selectedSiteId}
              onChange={(e) => { setSelectedSiteId(e.target.value ? Number(e.target.value) : ''); handleFilterChange(); }}
              disabled={sitesLoading}
              className={inputClass}
            >
              <option value="">{t('families.all_sites')}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fam-community" className={labelClass}>{t('families.col_community')}</label>
            <select
              id="fam-community"
              value={selectedCommunityId}
              onChange={(e) => { setSelectedCommunityId(e.target.value ? Number(e.target.value) : ''); handleFilterChange(); }}
              disabled={communitiesLoading}
              className={inputClass}
            >
              <option value="">{t('families.all_communities')}</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelClass}>{t('families.crisis_status')}</span>
            {/* Checked filters to families in crisis; unchecked means no crisis filter at all */}
            <label htmlFor="fam-crisis" className="flex items-center gap-2 py-2 cursor-pointer">
              <input
                id="fam-crisis"
                type="checkbox"
                checked={inCrisisFilter === true}
                onChange={(e) => { setInCrisisFilter(e.target.checked ? true : ''); handleFilterChange(); }}
                className="h-4 w-4 rounded border-hv-border-input text-hv-terracotta focus:ring-2 focus:ring-hv-accent"
              />
              <span className={`${compact ? 'text-sm' : ''} text-hv-charcoal`}>{t('families.col_crisis')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-hv-border">
        {/* Toolbar */}
        <div className="flex justify-end px-4 py-3 border-b border-hv-border">
          <div className="relative" ref={columnPickerRef}>
            <button
              onClick={() => setShowColumnPicker((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-hv-border rounded-md text-hv-charcoal hover:bg-hv-page transition-colors"
            >
              <Columns2 className="w-4 h-4" />
              {t('families.columns')}
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-hv-border rounded-lg shadow-lg p-3 min-w-[180px]">
                <p className="text-xs font-semibold text-hv-sage uppercase tracking-wider mb-2">{t('families.toggle_columns')}</p>
                <div className="space-y-1">
                  {ALL_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-hv-page text-sm text-hv-charcoal"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
                      />
                      {t(col.labelKey)}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {familiesLoading ? (
          <div className="text-center py-8"><p className="text-hv-gray">Loading families...</p></div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-red-600">
              Error loading families: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : families.length === 0 ? (
          <div className="text-center py-8"><p className="text-hv-gray">{t('families.none_matching')}</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hv-page">
                  <tr>
                    {activeColumns.map((col) => {
                      const isSortable = SORTABLE.has(col.key);
                      const isSorted = sortColumn === col.key;
                      return (
                        <th
                          key={col.key}
                          style={{ width: columnWidths[col.key], minWidth: 60 }}
                          className="relative px-4 py-3 text-left text-xs font-medium text-hv-sage uppercase tracking-wider whitespace-nowrap"
                        >
                          <span
                            className={`inline-flex items-center gap-1 ${isSortable ? 'cursor-pointer hover:text-hv-charcoal select-none' : ''}`}
                            onClick={isSortable ? () => handleSort(col.key as SortColumn) : undefined}
                          >
                            {t(col.labelKey)}
                            {isSortable && (
                              <span className="text-hv-border">
                                {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                              </span>
                            )}
                          </span>
                          <div
                            className="absolute right-0 top-0 h-full w-3 cursor-col-resize hover:bg-hv-accent/30 hidden md:block"
                            onMouseDown={(e) => handleResizeMouseDown(e, col.key)}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-hv-border">
                  {families.map((family) => (
                    <tr
                      key={family.id}
                      onClick={() => navigate(`/families/${family.id}`)}
                      className={`cursor-pointer ${highlightCrisis && family.inCrisis ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-hv-page'}`}
                    >
                      {activeColumns.map((col) => (
                        <td
                          key={col.key}
                          style={columnWidths[col.key] ? { width: columnWidths[col.key], maxWidth: columnWidths[col.key] } : undefined}
                          className="px-4 py-4 whitespace-nowrap overflow-hidden"
                        >
                          {renderCell(col.key, family, communityLookup, siteLookup, t)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-hv-border sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-hv-border text-sm font-medium rounded-md text-hv-charcoal bg-white hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="ml-3 px-4 py-2 border border-hv-border text-sm font-medium rounded-md text-hv-charcoal bg-white hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <p className="text-sm text-hv-sage">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * pageSize, totalFamilies)}</span>{' '}
                      of <span className="font-medium">{totalFamilies}</span> families
                    </p>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-2 rounded-l-md border border-hv-border bg-white text-sm text-hv-sage hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) pageNum = i + 1;
                        else if (currentPage <= 4) pageNum = i + 1;
                        else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
                        else pageNum = currentPage - 3 + i;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-hv-terracotta border-hv-terracotta text-white'
                                : 'bg-white border-hv-border text-hv-sage hover:bg-hv-page'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-2 rounded-r-md border border-hv-border bg-white text-sm text-hv-sage hover:bg-hv-page disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FamiliesTable;
