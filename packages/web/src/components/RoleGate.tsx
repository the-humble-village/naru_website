import React from 'react';
import { useAuthStore } from '../store/auth';

export type Role = 'ADMIN' | 'SUPERVISOR' | 'CASEWORKER';

interface RoleGateProps {
  children: React.ReactNode;
  requiredRole?: Role | Role[];
  fallback?: React.ReactNode;
}

/**
 * Role hierarchy for permission checking
 * ADMIN has all permissions
 * SUPERVISOR has SUPERVISOR + CASEWORKER permissions
 * CASEWORKER has only CASEWORKER permissions
 */
const roleHierarchy: Record<Role, Role[]> = {
  ADMIN: ['ADMIN', 'SUPERVISOR', 'CASEWORKER'],
  SUPERVISOR: ['SUPERVISOR', 'CASEWORKER'],
  CASEWORKER: ['CASEWORKER'],
};

/**
 * Check if user role has permission for required role(s)
 */
const hasPermission = (userRole: Role, requiredRole: Role | Role[]): boolean => {
  if (!userRole) return false;

  const userPermissions = roleHierarchy[userRole] || [];

  if (Array.isArray(requiredRole)) {
    return requiredRole.some(role => userPermissions.includes(role));
  }

  return userPermissions.includes(requiredRole);
};

/**
 * RoleGate component that conditionally renders children based on user role
 */
export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  requiredRole,
  fallback = null,
}) => {
  const { user } = useAuthStore();

  // If no role requirement specified, render children
  if (!requiredRole) {
    return <>{children}</>;
  }

  // If user is not authenticated, don't render
  if (!user) {
    return <>{fallback}</>;
  }

  // Check if user has required permissions
  const hasAccess = hasPermission(user.role, requiredRole);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleGate;