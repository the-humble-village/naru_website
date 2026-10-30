import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

export interface OverdueBadgeProps {
  lastVisitDate?: string | null;
  intervalDays?: number | null;
  className?: string;
}

const MS_PER_DAY = 86_400_000;

const daysSince = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - then) / MS_PER_DAY));
};

export const OverdueBadge: React.FC<OverdueBadgeProps> = ({
  lastVisitDate,
  intervalDays,
  className,
}) => {
  const { t } = useTranslation();

  const days = lastVisitDate ? daysSince(lastVisitDate) : null;

  if (days === null) {
    return (
      <span className={`text-sm text-hv-gray whitespace-nowrap${className ? ` ${className}` : ''}`}>
        {t('overdue.no_visits')}
      </span>
    );
  }

  const isOverdue =
    intervalDays !== null && intervalDays !== undefined && days > intervalDays;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-sm tabular-nums ${
        isOverdue ? 'font-semibold text-hv-crisis' : 'text-hv-gray'
      }${className ? ` ${className}` : ''}`}
    >
      {days}
      {t('overdue.day_suffix')}
      {isOverdue && (
        <>
          <span aria-hidden="true">&#9888;</span>
          <span className="sr-only">{t('overdue.overdue')}</span>
        </>
      )}
    </span>
  );
};

export default OverdueBadge;
