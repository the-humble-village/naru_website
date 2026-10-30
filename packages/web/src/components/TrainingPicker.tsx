import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export interface TrainingOption {
  id: number;
  title: string;
}

export interface TrainingPickerProps {
  options: TrainingOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  className?: string;
}

export const TrainingPicker: React.FC<TrainingPickerProps> = ({
  options,
  selectedIds,
  onChange,
  className,
}) => {
  const { t } = useTranslation();

  if (options.length === 0) {
    return <p className="text-sm text-hv-gray">{t('visit.no_trainings')}</p>;
  }

  const toggle = (id: number) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div
      role="group"
      aria-label={t('visit.trainings')}
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-hv-border-input rounded-md p-3${
        className ? ` ${className}` : ''
      }`}
    >
      {options.map((option) => (
        <label
          key={option.id}
          className="flex items-center gap-2 py-1 text-sm text-hv-charcoal cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(option.id)}
            onChange={() => toggle(option.id)}
            className="rounded border-hv-border-input text-hv-accent focus:ring-hv-accent"
          />
          <span>{option.title}</span>
        </label>
      ))}
    </div>
  );
};

export default TrainingPicker;
