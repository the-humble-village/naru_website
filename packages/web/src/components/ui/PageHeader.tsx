import React from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

/**
 * PageHeader - Reusable page header with title, optional back link, and optional action buttons.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, backTo, backLabel, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
      <div className="flex flex-col gap-1">
        {backTo && backLabel && (
          <Link to={backTo} className="text-hv-terracotta hover:underline transition-colors text-sm">
            ← {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal">{title}</h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
