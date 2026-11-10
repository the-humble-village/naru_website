import React from 'react';
import { classifyZScore } from '@naru/shared';
import { NUTRITION_STATUS_STYLE } from '../utils/nutritionStatus';

export interface ZScoreBadgeProps {
  zScore: number | null;
  label?: string;
  showValue?: boolean;
}

/**
 * ZScoreBadge component that displays a color-coded badge based on z-score classification
 */
export const ZScoreBadge: React.FC<ZScoreBadgeProps> = ({
  zScore,
  label = 'Z-Score',
  showValue = true
}) => {
  if (zScore === null || zScore === undefined) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
        {label}: No data
      </div>
    );
  }

  const classification = classifyZScore(zScore);

  // Color mapping based on classification
  const colorClasses = {
    severe: NUTRITION_STATUS_STYLE.SEVERE.badge,
    moderate: NUTRITION_STATUS_STYLE.MODERATE.badge,
    mild: NUTRITION_STATUS_STYLE.MILD.badge,
    normal: NUTRITION_STATUS_STYLE.NORMAL.badge,
    above: 'bg-blue-500 text-white',
    high: 'bg-purple-500 text-white',
  };

  // Display text mapping
  const displayText = {
    severe: 'Severe',
    moderate: 'Moderate',
    mild: 'Mild',
    normal: 'Normal',
    above: 'Above Normal',
    high: 'High',
  };

  const colorClass = colorClasses[classification] || 'bg-gray-500 text-white';
  const displayLabel = displayText[classification] || 'Unknown';

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
      {label}: {displayLabel}
      {showValue && (
        <span className="ml-2 font-mono text-xs">
          ({zScore.toFixed(2)})
        </span>
      )}
    </div>
  );
};

export default ZScoreBadge;
