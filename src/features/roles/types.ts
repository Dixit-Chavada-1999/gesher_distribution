/**
 * Role Module Types
 */

// ============================================
// ENTITY TYPES
// ============================================

/**
 * Role entity
 */
export interface Role {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Permission entity
 */
export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  module: string;
  action: string;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Role-Permission junction
 */
export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  createdAt: Date;
  createdBy: string | null;
}

/**
 * Role with permissions included
 */
export interface RoleWithPermissions extends Role {
  rolePermissions: (RolePermission & {
    permission: Permission;
  })[];
  _count?: {
    users: number;
  };
}

/**
 * Permission grouped by module
 */
export interface PermissionGroup {
  module: string;
  permissions: Permission[];
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/**
 * Data for creating a new role
 */
export interface CreateRoleData {
  name: string;
  slug: string;
  displayName: string;
  description?: string;
  level?: number;
  isSystem?: boolean;
  permissionIds?: string[];
}

/**
 * Data for updating a role
 */
export interface UpdateRoleData {
  name?: string;
  displayName?: string;
  description?: string;
  level?: number;
  permissionIds?: string[];
}

/**
 * Data for creating a permission
 */
export interface CreatePermissionData {
  name: string;
  displayName: string;
  description?: string;
  module: string;
  action: string;
  category?: string;
}

/**
 * Data for updating a permission
 */
export interface UpdatePermissionData {
  displayName?: string;
  description?: string;
  category?: string;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Role query filters
 */
export interface RoleQueryFilters {
  search?: string;
  isSystem?: boolean;
  minLevel?: number;
  maxLevel?: number;
}

/**
 * Permission query filters
 */
export interface PermissionQueryFilters {
  search?: string;
  module?: string;
  action?: string;
  category?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Role list item for display
 */
export interface RoleListItem {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  createdAt: Date;
}

/**
 * Role detail with all permissions
 */
export interface RoleDetail extends RoleListItem {
  permissions: Permission[];
}

/**
 * Permission matrix row
 */
export interface PermissionMatrixRow {
  permission: Permission;
  roleAssignments: Record<string, boolean>;
}
