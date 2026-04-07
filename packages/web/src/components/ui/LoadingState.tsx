import React from 'react';

interface LoadingStateProps {
  message?: string;
}

/**
 * LoadingState - Simple centered loading indicator.
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="text-lg text-hv-gray py-8 text-center">{message}</div>
  );
};

export default LoadingState;
