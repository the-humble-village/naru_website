import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export interface WeightDeltaProps {
  from?: number | null;
  to?: number | null;
  unit?: string;
  className?: string;
}

const format = (value: number): string => value.toFixed(1);

export const WeightDelta: React.FC<WeightDeltaProps> = ({
  from,
  to,
  unit = 'kg',
  className,
}) => {
  const { t } = useTranslation();

  const start = from ?? null;
  const end = to ?? null;
  const wrapper = `inline-flex items-center gap-1.5 whitespace-nowrap${
    className ? ` ${className}` : ''
  }`;

  if (start !== null && end !== null) {
    const delta = end - start;
    const tone =
      delta > 0 ? 'text-hv-green' : delta < 0 ? 'text-hv-crisis' : 'text-hv-gray';
    const direction =
      delta > 0 ? 'weight.increased' : delta < 0 ? 'weight.decreased' : 'weight.unchanged';

    return (
      <span className={wrapper}>
        <span className="text-hv-charcoal tabular-nums">{format(start)}</span>
        <span className={tone} aria-hidden="true">
          &rarr;
        </span>
        <span className="text-hv-charcoal font-medium tabular-nums">{format(end)}</span>
        <span className={`font-semibold tabular-nums ${tone}`}>
          {delta > 0 ? '+' : ''}
          {format(delta)}
        </span>
        <span className="text-sm text-hv-gray">{unit}</span>
        <span className="sr-only">{t(direction)}</span>
      </span>
    );
  }

  if (start !== null || end !== null) {
    const only = start !== null ? start : (end as number);
    return (
      <span className={wrapper}>
        <span className="text-hv-charcoal tabular-nums">{format(only)}</span>
        <span className="text-sm text-hv-gray">{unit}</span>
      </span>
    );
  }

  return (
    <span className={`text-hv-gray${className ? ` ${className}` : ''}`}>
      <span aria-hidden="true">&mdash;</span>
      <span className="sr-only">{t('weight.no_data')}</span>
    </span>
  );
};

export default WeightDelta;
