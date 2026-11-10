import React from 'react';

interface EmptyStateProps {
  message: string;
}

/**
 * EmptyState - Simple empty state message.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => {
  return (
    <p className="text-hv-gray text-center py-4">{message}</p>
  );
};

export default EmptyState;
