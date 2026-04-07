import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

export const ErrorPage: React.FC = () => {
  const error = useRouteError();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen bg-hv-page flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border border-hv-border p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-serif font-bold text-hv-charcoal mb-2">{title}</h1>
        <p className="text-hv-gray text-sm mb-6">{message}</p>
        <Link
          to="/"
          className="inline-block bg-hv-terracotta text-white px-4 py-2 rounded-md hover:bg-hv-terracotta-hover transition-colors text-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default ErrorPage;
