import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { ageInDays, type TranslationKey } from '@naru/shared';
import { useTranslation } from '../../hooks';
import type { FilterOption, FilterValues } from '../FilterBar';

export const DIRECTORY_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hv-green focus-visible:ring-offset-2';
export const DIRECTORY_FIELD = `min-h-11 w-full min-w-0 rounded-lg border border-hv-border-input bg-white px-3 py-2 text-sm text-hv-charcoal ${DIRECTORY_FOCUS}`;
const LABEL = 'mb-1.5 block text-sm font-medium text-hv-green';

type DirectoryKind = 'mothers' | 'children' | 'persons' | 'families' | 'unenrolled';
const COUNT_KEYS = {
  mothers: ['directory.mother_count', 'directory.mothers_count'],
  children: ['directory.child_count', 'directory.children_count'],
  persons: ['directory.person_count', 'directory.persons_count'],
  families: ['directory.family_count', 'directory.families_count'],
  unenrolled: ['directory.record_count', 'directory.records_count'],
} as const;

export function directoryCount(t: (key: TranslationKey) => string, kind: DirectoryKind, count: number) {
  return t(COUNT_KEYS[kind][count === 1 ? 0 : 1]).replace('{count}', String(count));
}

export function formatDirectoryAge(birthDate: string | null | undefined, lang = 'en'): string {
  if (!birthDate) return '—';
  const days = ageInDays(new Date(birthDate));
  if (days === null || !Number.isFinite(days) || days < 0) return '—';
  const months = Math.floor(days / 30.4375);
  const unit = days < 61 ? 'day' : months < 24 ? 'month' : 'year';
  const value = unit === 'day' ? days : unit === 'month' ? months : Math.floor(days / 365.25);
  return new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

export function DirectoryHeader({ title, description, action }: {
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  return (
    <header className="mb-5 grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
      <div className="text-center sm:col-start-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-hv-green">{title}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-hv-gray">{description}</p>
      </div>
      {action && (
        <Link to={action.to} className={`inline-flex min-h-11 items-center justify-center gap-2 justify-self-center rounded-lg bg-hv-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-hv-terracotta-hover sm:justify-self-end ${DIRECTORY_FOCUS}`}>
          <Plus size={17} aria-hidden="true" />{action.label}
        </Link>
      )}
    </header>
  );
}

interface DirectoryFiltersProps {
  search: string;
  searchLabel: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  sites: FilterOption[];
  communities: FilterOption[];
  onClear: () => void;
  extra?: React.ReactNode;
  extraActive?: boolean;
  sitesLoading?: boolean;
  communitiesLoading?: boolean;
}

export function DirectoryFilters({ search, searchLabel, searchPlaceholder, onSearchChange, value, onChange, sites, communities, onClear, extra, extraActive = false, sitesLoading = false, communitiesLoading = false }: DirectoryFiltersProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const hasFilters = search !== '' || value.siteId != null || value.communityId != null || extraActive;
  return (
    <section aria-label={t('directory.filters')} className="mb-4 rounded-xl border border-hv-green/15 bg-[#eaf0e9] p-4">
      <div className={`grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2 ${extra ? 'xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]' : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'}`}>
        <div className="min-w-0">
          <label htmlFor={searchId} className={LABEL}>{searchLabel}</label>
          <div className="relative">
            <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hv-gray" />
            <input id={searchId} type="search" value={search} onChange={event => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder ?? t('subject.search_placeholder')} className={`${DIRECTORY_FIELD} pl-10`} />
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="filter-site" className={LABEL}>{t('filter.site')}</label>
          <select id="filter-site" className={DIRECTORY_FIELD} value={value.siteId ?? ''} disabled={sitesLoading}
            onChange={event => onChange({ ...value, siteId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">{t('visit.all_sites')}</option>
            {sites.map(site => <option key={site.id} value={site.id}>{site.title}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="filter-community" className={LABEL}>{t('filter.community')}</label>
          <select id="filter-community" className={DIRECTORY_FIELD} value={value.communityId ?? ''} disabled={communitiesLoading}
            onChange={event => onChange({ ...value, communityId: event.target.value ? Number(event.target.value) : null })}>
            <option value="">{t('visit.all_communities')}</option>
            {communities.map(community => <option key={community.id} value={community.id}>{community.title}</option>)}
          </select>
        </div>
        {extra}
        <button type="button" onClick={onClear} disabled={!hasFilters}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded px-3 text-sm font-medium text-hv-green transition-colors hover:bg-hv-green/5 disabled:cursor-default disabled:text-hv-gray ${DIRECTORY_FOCUS}`}>
          <RotateCcw size={17} aria-hidden="true" />{t('roster.clear_filters')}
        </button>
      </div>
    </section>
  );
}

export function DirectoryPanel({ title, toolbar, children }: { title: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-hv-border bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="font-serif text-xl font-bold text-hv-green">{title}</h2>
        {toolbar}
      </div>
      {children}
    </section>
  );
}

export function DirectoryNameLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className={`rounded font-semibold text-hv-green underline decoration-hv-green/30 underline-offset-2 hover:decoration-hv-green ${DIRECTORY_FOCUS}`}>{children}</Link>;
}

export function DirectoryEditLink({ to }: { to: string }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded px-1 text-sm text-hv-terracotta hover:text-hv-green ${DIRECTORY_FOCUS}`}>
      <Pencil size={15} aria-hidden="true" />{t('common.edit')}
    </Link>
  );
}

export interface DirectoryColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  header?: React.ReactNode;
  style?: React.CSSProperties;
  ariaSort?: React.AriaAttributes['aria-sort'];
}

export function DirectoryTable<T>({ rows, columns, rowKey, rowTitle, label, onRowClick, mobileActionBelow = false }: {
  rows: T[];
  columns: DirectoryColumn<T>[];
  rowKey: (row: T) => React.Key;
  rowTitle: (row: T) => React.ReactNode;
  label: string;
  onRowClick?: (row: T) => void;
  mobileActionBelow?: boolean;
}) {
  const action = columns.find(column => column.key === 'actions');
  return (
    <>
      <div role="region" aria-label={label} tabIndex={0} className={`hidden max-w-full overflow-x-auto rounded-lg md:block ${DIRECTORY_FOCUS}`}>
        <table aria-label={label} className="w-full border-collapse">
          <thead className="bg-[#eaf0e9]">
            <tr>
              {columns.map(column => (
                <th key={column.key} scope="col" style={column.style} aria-sort={column.ariaSort}
                  className="relative px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-hv-green">
                  {column.header ?? column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hv-border">
            {rows.map(row => (
              <tr key={rowKey(row)} className={`hover:bg-[#eaf0e9]/40 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? event => {
                  if (!(event.target as HTMLElement).closest('a,button,input,select')) onRowClick(row);
                } : undefined}>
                {columns.map(column => (
                  <td key={column.key} style={column.style} className={`px-3 py-2 text-sm text-hv-charcoal ${column.key === 'age' ? 'whitespace-nowrap' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map(row => (
          <li key={rowKey(row)} className="min-w-0 rounded-lg border border-hv-green/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 break-words">{rowTitle(row)}</div>
              {action && !mobileActionBelow && <div className="shrink-0">{action.render(row)}</div>}
            </div>
            <dl className="mt-3 space-y-2 border-t border-hv-green/10 pt-3">
              {columns.filter(column => column.key !== 'name' && column.key !== 'actions').map(column => (
                <div key={column.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3 text-sm">
                  <dt className="text-hv-gray">{column.label}</dt>
                  <dd className="min-w-0 break-words text-hv-charcoal">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
            {action && mobileActionBelow && <div className="mt-3">{action.render(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function DirectoryPagination({ page, totalPages, onPageChange, resultText }: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  resultText: string;
}) {
  const { t } = useTranslation();
  const button = `inline-flex min-h-11 items-center gap-1 rounded px-2 text-sm text-hv-green hover:bg-[#eaf0e9] disabled:cursor-default disabled:text-hv-gray disabled:opacity-60 ${DIRECTORY_FOCUS}`;
  return (
    <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hv-border px-1 pt-3 text-sm text-hv-gray">
      <p role="status">{resultText}</p>
      <nav aria-label={t('directory.pagination')} className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={page === 0} onClick={() => onPageChange(Math.max(0, page - 1))} className={button}>
          <ChevronLeft size={16} aria-hidden="true" />{t('common.previous')}
        </button>
        {totalPages > 1 && <span className="text-xs">{t('common.page')} {page + 1} {t('common.of')} {totalPages}</span>}
        <button type="button" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)} className={button}>
          {t('common.next')}<ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
    </footer>
  );
}
