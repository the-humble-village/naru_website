import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export interface RedirectRouteProps {
  /** Target path; `:name` segments are substituted from the matched route params. */
  to: string;
  replace?: boolean;
}

/**
 * Client-side redirect from a V1 family-nested path to its flat V2 replacement,
 * so existing bookmarks keep working for one release (WEB_DESIGN_V2 §3).
 */
export const RedirectRoute: React.FC<RedirectRouteProps> = ({ to, replace = true }) => {
  const params = useParams();
  const target = to.replace(/:([A-Za-z0-9_]+)/g, (match, key: string) => params[key] ?? match);

  return <Navigate to={target} replace={replace} />;
};

export default RedirectRoute;
