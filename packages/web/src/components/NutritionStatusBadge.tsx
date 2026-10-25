import React from 'react';
import type { NutritionalStatus } from '@naru/shared';
import { useTranslation } from '../hooks/useTranslation';
import { NUTRITION_STATUS_STYLE } from '../utils/nutritionStatus';

export const NutritionStatusBadge: React.FC<{
  status: NutritionalStatus;
  'data-testid'?: string;
}> = ({ status, 'data-testid': testId }) => {
  const { t } = useTranslation();
  const style = NUTRITION_STATUS_STYLE[status];
  return (
    <span data-testid={testId} data-nutrition-status={status}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>
      {t(style.label)}
    </span>
  );
};
