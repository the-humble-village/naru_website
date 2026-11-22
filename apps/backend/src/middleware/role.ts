import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { type Role, type UserRead } from '@naru/shared';

/**
 * Role hierarchy for permission checks
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  CASEWORKER: 1,
  SUPERVISOR: 2,
  ADMIN: 3,
};

/**
 * Middleware factory that creates a role gate requiring a minimum role level.
 *
 * Role hierarchy: CASEWORKER < SUPERVISOR < ADMIN
 * - ADMIN can access everything
 * - SUPERVISOR can access SUPERVISOR and CASEWORKER routes
 * - CASEWORKER can only access CASEWORKER routes
 *
 * @param requiredRole - Minimum role required to access the route
 * @returns Hono middleware function
 *
 * @example
 * app.get('/admin-only', auth, requireRole('ADMIN'), handler)
 * app.delete('/supervisor-plus', auth, requireRole('SUPERVISOR'), handler)
 */
export function requireRole(requiredRole: Role) {
  return async (c: Context, next: Next): Promise<void> => {
    // Get the authenticated user from context (set by auth middleware)
    const user = c.get('user') as UserRead | undefined;

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required. Make sure to use auth middleware before requireRole.'
      });
    }

    const userRoleLevel = ROLE_HIERARCHY[user.role];
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${requiredRole} or higher. Your role: ${user.role}`
      });
    }

    await next();
  };
}

/**
 * Helper function to check if a user has sufficient role level.
 * Useful for conditional logic in route handlers.
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns True if user has sufficient permissions
 */
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Helper function to check if a user is an admin.
 */
export function isAdmin(userRole: Role): boolean {
  return userRole === 'ADMIN';
}

/**
 * Helper function to check if a user is supervisor or higher.
 */
export function isSupervisorOrHigher(userRole: Role): boolean {
  return hasRole(userRole, 'SUPERVISOR');
}

/**
 * Middleware that requires admin role specifically.
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware that requires supervisor role or higher.
 */
export const requireSupervisor = requireRole('SUPERVISOR');

/**
 * Middleware that requires any authenticated role (caseworker+).
 * This is essentially a no-op since auth middleware already ensures the user exists,
 * but it makes the intent explicit in route definitions.
 */
export const requireCaseworker = requireRole('CASEWORKER');