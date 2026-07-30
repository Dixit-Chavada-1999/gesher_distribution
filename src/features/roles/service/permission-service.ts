/**
 * Permission Service
 *
 * Business logic for Permission management.
 */

import { ValidationError } from '@/shared/lib/errors';
import { auditService } from '@/shared/lib/audit';
import { logger } from '@/shared/lib/logger';
import { permissionRepository } from '../repository';
import type {
  Permission,
  CreatePermissionData,
  PermissionQueryFilters,
  PermissionGroup,
} from '../types';

/**
 * Service context for operations
 */
export interface ServiceContext {
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

class PermissionServiceImpl {
  private readonly serviceName = 'PermissionService';

  /**
   * Get all permissions
   */
  async getAllPermissions(filters?: PermissionQueryFilters): Promise<Permission[]> {
    return permissionRepository.findAllFiltered(filters);
  }

  /**
   * Get permissions grouped by module
   */
  async getPermissionsGrouped(): Promise<PermissionGroup[]> {
    return permissionRepository.findAllGroupedByModule();
  }

  /**
   * Get all modules
   */
  async getModules(): Promise<string[]> {
    return permissionRepository.getModules();
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    return permissionRepository.getCategories();
  }

  /**
   * Get permission by name
   */
  async getByName(name: string): Promise<Permission | null> {
    return permissionRepository.findByName(name);
  }

  /**
   * Get permissions for a role
   */
  async getByRoleId(roleId: string): Promise<Permission[]> {
    return permissionRepository.getByRoleId(roleId);
  }

  /**
   * Get permission IDs for a role
   */
  async getIdsByRoleId(roleId: string): Promise<string[]> {
    return permissionRepository.getIdsByRoleId(roleId);
  }

  /**
   * Create permission
   */
  async createPermission(
    data: CreatePermissionData,
    ctx?: ServiceContext
  ): Promise<Permission> {
    logger.info(`${this.serviceName}.createPermission`, { userId: ctx?.userId });

    // Validate
    if (!data.name?.trim()) {
      throw ValidationError.required('name');
    }

    if (!data.displayName?.trim()) {
      throw ValidationError.required('displayName');
    }

    if (!data.module?.trim()) {
      throw ValidationError.required('module');
    }

    if (!data.action?.trim()) {
      throw ValidationError.required('action');
    }

    // Check uniqueness
    const isUnique = await permissionRepository.isNameUnique(data.name);
    if (!isUnique) {
      throw ValidationError.field('name', 'Permission with this name already exists');
    }

    // Create
    const permission = await permissionRepository.create(data, ctx?.userId);

    // Audit log
    await auditService.logCreate(
      'roles',
      'Permission',
      permission.id,
      {
        name: permission.name,
        module: permission.module,
        action: permission.action,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return permission;
  }

  /**
   * Seed default permissions
   */
  async seedDefaultPermissions(ctx?: ServiceContext): Promise<number> {
    logger.info(`${this.serviceName}.seedDefaultPermissions`, { userId: ctx?.userId });

    const defaultPermissions: CreatePermissionData[] = [
      // Dashboard
      { name: 'dashboard.view', displayName: 'View Dashboard', module: 'dashboard', action: 'view', category: 'Dashboard' },

      // Users
      { name: 'users.view', displayName: 'View Users', module: 'users', action: 'view', category: 'User Management' },
      { name: 'users.create', displayName: 'Create Users', module: 'users', action: 'create', category: 'User Management' },
      { name: 'users.edit', displayName: 'Edit Users', module: 'users', action: 'edit', category: 'User Management' },
      { name: 'users.delete', displayName: 'Delete Users', module: 'users', action: 'delete', category: 'User Management' },
      { name: 'users.export', displayName: 'Export Users', module: 'users', action: 'export', category: 'User Management' },

      // Roles
      { name: 'roles.view', displayName: 'View Roles', module: 'roles', action: 'view', category: 'Role Management' },
      { name: 'roles.create', displayName: 'Create Roles', module: 'roles', action: 'create', category: 'Role Management' },
      { name: 'roles.edit', displayName: 'Edit Roles', module: 'roles', action: 'edit', category: 'Role Management' },
      { name: 'roles.delete', displayName: 'Delete Roles', module: 'roles', action: 'delete', category: 'Role Management' },
      { name: 'roles.manage', displayName: 'Manage Role Permissions', module: 'roles', action: 'manage', category: 'Role Management' },

      // Permissions
      { name: 'permissions.view', displayName: 'View Permissions', module: 'permissions', action: 'view', category: 'Permission Management' },
      { name: 'permissions.manage', displayName: 'Manage Permissions', module: 'permissions', action: 'manage', category: 'Permission Management' },

      // Audit Logs
      { name: 'audit.view', displayName: 'View Audit Logs', module: 'audit', action: 'view', category: 'Audit' },
      { name: 'audit.export', displayName: 'Export Audit Logs', module: 'audit', action: 'export', category: 'Audit' },

      // Settings
      { name: 'settings.view', displayName: 'View Settings', module: 'settings', action: 'view', category: 'Settings' },
      { name: 'settings.edit', displayName: 'Edit Settings', module: 'settings', action: 'edit', category: 'Settings' },

      // Products
      { name: 'products.view', displayName: 'View Products', module: 'products', action: 'view', category: 'Products' },
      { name: 'products.create', displayName: 'Create Products', module: 'products', action: 'create', category: 'Products' },
      { name: 'products.edit', displayName: 'Edit Products', module: 'products', action: 'edit', category: 'Products' },
      { name: 'products.delete', displayName: 'Delete Products', module: 'products', action: 'delete', category: 'Products' },

      // Customers
      { name: 'customers.view', displayName: 'View Customers', module: 'customers', action: 'view', category: 'Customers' },
      { name: 'customers.create', displayName: 'Create Customers', module: 'customers', action: 'create', category: 'Customers' },
      { name: 'customers.edit', displayName: 'Edit Customers', module: 'customers', action: 'edit', category: 'Customers' },
      { name: 'customers.delete', displayName: 'Delete Customers', module: 'customers', action: 'delete', category: 'Customers' },

      // Orders
      { name: 'orders.view', displayName: 'View Orders', module: 'orders', action: 'view', category: 'Orders' },
      { name: 'orders.create', displayName: 'Create Orders', module: 'orders', action: 'create', category: 'Orders' },
      { name: 'orders.edit', displayName: 'Edit Orders', module: 'orders', action: 'edit', category: 'Orders' },
      { name: 'orders.delete', displayName: 'Delete Orders', module: 'orders', action: 'delete', category: 'Orders' },
      { name: 'orders.approve', displayName: 'Approve Orders', module: 'orders', action: 'approve', category: 'Orders' },

      // Inventory
      { name: 'inventory.view', displayName: 'View Inventory', module: 'inventory', action: 'view', category: 'Inventory' },
      { name: 'inventory.manage', displayName: 'Manage Inventory', module: 'inventory', action: 'manage', category: 'Inventory' },
      { name: 'inventory.adjust', displayName: 'Adjust Inventory', module: 'inventory', action: 'adjust', category: 'Inventory' },

      // Reports
      { name: 'reports.view', displayName: 'View Reports', module: 'reports', action: 'view', category: 'Reports' },
      { name: 'reports.export', displayName: 'Export Reports', module: 'reports', action: 'export', category: 'Reports' },
    ];

    const count = await permissionRepository.createMany(defaultPermissions, ctx?.userId);

    if (count > 0) {
      await auditService.log({
        action: 'import',
        module: 'roles',
        entityType: 'Permission',
        description: `Seeded ${count} default permissions`,
        metadata: { count },
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      });
    }

    return count;
  }
}

export const permissionService = new PermissionServiceImpl();
export { PermissionServiceImpl };
