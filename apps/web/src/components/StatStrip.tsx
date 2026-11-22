import React from 'react';
import { Link } from 'react-router-dom';

export interface StatStripItem {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'crisis';
  to?: string;
}

export interface StatStripProps {
  stats: StatStripItem[];
  className?: string;
}

const CELL = 'bg-white p-8 rounded-lg';

export const StatStrip: React.FC<StatStripProps> = ({ stats, className }) => {
  if (stats.length === 0) {
    return null;
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4${className ? ` ${className}` : ''}`}>
      {stats.map((stat, index) => {
        const body = (
          <>
            <div
              className={`text-4xl font-bold ${
                stat.tone === 'crisis' ? 'text-hv-crisis' : 'text-hv-green'
              }`}
            >
              {stat.value}
            </div>
            <div className="text-sm text-hv-gray mt-1">{stat.label}</div>
          </>
        );

        return stat.to ? (
          <Link
            key={`${stat.label}-${index}`}
            to={stat.to}
            className={`${CELL} block hover:bg-hv-page transition-colors`}
          >
            {body}
          </Link>
        ) : (
          <div key={`${stat.label}-${index}`} className={CELL}>
            {body}
          </div>
        );
      })}
    </div>
  );
};

export default StatStrip;
