import React from 'react';

interface StatCardProps {
  value: number | string;
  label: string;
  variant?: 'default' | 'crisis';
}

/**
 * StatCard - Displays a large statistic value with a label.
 * variant 'default' uses text-hv-green, 'crisis' uses text-hv-crisis.
 */
export const StatCard: React.FC<StatCardProps> = ({ value, label, variant = 'default' }) => {
  const valueClass = variant === 'crisis' ? 'text-4xl font-bold text-hv-crisis' : 'text-4xl font-bold text-hv-green';

  return (
    <div className="bg-white p-8 rounded-xl">
      <div className={valueClass}>{value}</div>
      <div className="text-sm text-hv-sage mt-2 uppercase tracking-wide">{label}</div>
    </div>
  );
};

export default StatCard;
