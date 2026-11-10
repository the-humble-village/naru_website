import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export type FilterField = 'dateRange' | 'site' | 'program' | 'community';

export interface FilterOption {
  id: number;
  title: string;
}

export interface FilterValues {
  dateFrom?: string | null;
  dateTo?: string | null;
  siteId?: number | null;
  programId?: number | null;
  communityId?: number | null;
}

export interface FilterBarProps {
  fields: FilterField[];
  value: FilterValues;
  onChange: (value: FilterValues) => void;
  sites?: FilterOption[];
  programs?: FilterOption[];
  communities?: FilterOption[];
  onApply?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const LABEL = 'block text-sm font-medium text-hv-gray mb-1';
const FIELD =
  'w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';

export const FilterBar: React.FC<FilterBarProps> = ({
  fields,
  value,
  onChange,
  sites,
  programs,
  communities,
  onApply,
  actions,
  className,
}) => {
  const { t } = useTranslation();

  const has = (field: FilterField) => fields.includes(field);

  const selectId = (key: 'siteId' | 'programId' | 'communityId') => (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    onChange({ ...value, [key]: event.target.value === '' ? null : Number(event.target.value) });
  };

  const renderSelect = (
    id: string,
    label: string,
    key: 'siteId' | 'programId' | 'communityId',
    options: FilterOption[]
  ) => (
    <div className="min-w-0 md:w-48">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select id={id} value={value[key] ?? ''} onChange={selectId(key)} className={FIELD}>
        <option value="">{t('common.all')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className={`bg-white p-4 rounded-lg border border-hv-border flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end${
        className ? ` ${className}` : ''
      }`}
    >
      {has('dateRange') && (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
          <div className="min-w-0 sm:w-44">
            <label htmlFor="filter-date-from" className={LABEL}>
              {t('filter.date_from')}
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={value.dateFrom ?? ''}
              onChange={(event) =>
                onChange({ ...value, dateFrom: event.target.value === '' ? null : event.target.value })
              }
              className={FIELD}
            />
          </div>
          <div className="min-w-0 sm:w-44">
            <label htmlFor="filter-date-to" className={LABEL}>
              {t('filter.date_to')}
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={value.dateTo ?? ''}
              onChange={(event) =>
                onChange({ ...value, dateTo: event.target.value === '' ? null : event.target.value })
              }
              className={FIELD}
            />
          </div>
        </div>
      )}

      {has('site') && renderSelect('filter-site', t('filter.site'), 'siteId', sites ?? [])}
      {has('program') &&
        renderSelect('filter-program', t('filter.program'), 'programId', programs ?? [])}
      {has('community') &&
        renderSelect('filter-community', t('filter.community'), 'communityId', communities ?? [])}

      {(onApply || actions) && (
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="bg-hv-green text-white px-4 py-2 rounded hover:bg-hv-green-hover transition-colors"
            >
              {t('filter.apply')}
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
