import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export interface ResourceOption {
  id: number;
  title: string;
  defaultUnit?: string | null;
}

export interface ResourceRowValue {
  resourceId: number | null;
  quantity: number | null;
  unit: string | null;
}

export interface ResourceRowProps {
  options: ResourceOption[];
  value: ResourceRowValue;
  onChange: (value: ResourceRowValue) => void;
  onRemove: () => void;
  unitOptions?: string[];
}

const FIELD =
  'w-full px-3 py-2 bg-white border border-hv-border-input rounded-md focus:outline-none focus:ring-2 focus:ring-hv-accent';

export const ResourceRow: React.FC<ResourceRowProps> = ({
  options,
  value,
  onChange,
  onRemove,
  unitOptions,
}) => {
  const { t } = useTranslation();

  const units = useMemo(() => {
    const seen = new Set<string>();
    options.forEach((option) => {
      if (option.defaultUnit) {
        seen.add(option.defaultUnit);
      }
    });
    (unitOptions ?? []).forEach((unit) => seen.add(unit));
    if (value.unit) {
      seen.add(value.unit);
    }
    return Array.from(seen).sort();
  }, [options, unitOptions, value.unit]);

  const handleResource = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const resourceId = event.target.value === '' ? null : Number(event.target.value);
    const picked = options.find((option) => option.id === resourceId);
    onChange({
      ...value,
      resourceId,
      unit: picked?.defaultUnit ?? value.unit ?? null,
    });
  };

  const handleQuantity = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const parsed = Number(raw);
    onChange({
      ...value,
      quantity: raw === '' || Number.isNaN(parsed) ? null : parsed,
    });
  };

  const handleUnit = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, unit: event.target.value === '' ? null : event.target.value });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        aria-label={t('visit.resource')}
        value={value.resourceId ?? ''}
        onChange={handleResource}
        className={`${FIELD} sm:flex-1`}
      >
        <option value="">{t('visit.select_resource')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>

      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        aria-label={t('visit.quantity')}
        placeholder={t('visit.quantity')}
        value={value.quantity ?? ''}
        onChange={handleQuantity}
        className={`${FIELD} sm:w-28`}
      />

      <select
        aria-label={t('visit.unit')}
        value={value.unit ?? ''}
        onChange={handleUnit}
        className={`${FIELD} sm:w-36`}
      >
        <option value="">{t('visit.unit')}</option>
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('common.remove')}
        className="self-end shrink-0 p-2 rounded-md text-hv-gray hover:text-hv-crisis hover:bg-red-50 transition-colors sm:self-auto"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ResourceRow;
