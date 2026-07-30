'use client';

/**
 * PermissionGate Component
 *
 * Conditionally renders children based on user permissions.
 * Use for hiding/showing UI elements based on access control.
 */

import { usePermission, usePermissions, useAnyPermission, useRole, useAnyRole } from '@/shared/hooks';

// ============================================
// TYPES
// ============================================

interface BaseGateProps {
  /** Content to render if authorized */
  children: React.ReactNode;
  /** Content to render if not authorized */
  fallback?: React.ReactNode;
  /** Show loading state while checking */
  showLoading?: boolean;
}

interface PermissionGateProps extends BaseGateProps {
  /** Required permission */
  permission: string;
}

interface PermissionsGateProps extends BaseGateProps {
  /** Required permissions (ALL must be present) */
  permissions: string[];
}

interface AnyPermissionGateProps extends BaseGateProps {
  /** Required permissions (ANY must be present) */
  permissions: string[];
}

interface RoleGateProps extends BaseGateProps {
  /** Required role */
  role: string;
}

interface RolesGateProps extends BaseGateProps {
  /** Required roles (ANY must match) */
  roles: string[];
}

// ============================================
// SINGLE PERMISSION GATE
// ============================================

/**
 * Gate that requires a single permission
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  showLoading = false,
}: PermissionGateProps) {
  const { hasAccess, isLoading } = usePermission(permission);

  if (isLoading && showLoading) {
    return <GateLoading />;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// MULTIPLE PERMISSIONS GATE (ALL)
// ============================================

/**
 * Gate that requires ALL specified permissions
 */
export function PermissionsGate({
  permissions,
  children,
  fallback = null,
  showLoading = false,
}: PermissionsGateProps) {
  const { hasAccess, isLoading } = usePermissions(permissions);

  if (isLoading && showLoading) {
    return <GateLoading />;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// MULTIPLE PERMISSIONS GATE (ANY)
// ============================================

/**
 * Gate that requires ANY of the specified permissions
 */
export function AnyPermissionGate({
  permissions,
  children,
  fallback = null,
  showLoading = false,
}: AnyPermissionGateProps) {
  const { hasAccess, isLoading } = useAnyPermission(permissions);

  if (isLoading && showLoading) {
    return <GateLoading />;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// ROLE GATE
// ============================================

/**
 * Gate that requires a specific role
 */
export function RoleGate({
  role,
  children,
  fallback = null,
  showLoading = false,
}: RoleGateProps) {
  const { hasAccess, isLoading } = useRole(role);

  if (isLoading && showLoading) {
    return <GateLoading />;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// MULTIPLE ROLES GATE
// ============================================

/**
 * Gate that requires ANY of the specified roles
 */
export function RolesGate({
  roles,
  children,
  fallback = null,
  showLoading = false,
}: RolesGateProps) {
  const { hasAccess, isLoading } = useAnyRole(roles);

  if (isLoading && showLoading) {
    return <GateLoading />;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// ADMIN GATE
// ============================================

/**
 * Gate that requires admin role (Super Admin or Admin)
 */
export function AdminGate({
  children,
  fallback = null,
  showLoading = false,
}: BaseGateProps) {
  return (
    <RolesGate
      roles={['Super Admin', 'Admin']}
      fallback={fallback}
      showLoading={showLoading}
    >
      {children}
    </RolesGate>
  );
}

/**
 * Gate that requires super admin role
 */
export function SuperAdminGate({
  children,
  fallback = null,
  showLoading = false,
}: BaseGateProps) {
  return (
    <RoleGate
      role="Super Admin"
      fallback={fallback}
      showLoading={showLoading}
    >
      {children}
    </RoleGate>
  );
}

// ============================================
// LOADING COMPONENT
// ============================================

function GateLoading() {
  return (
    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
  );
}
