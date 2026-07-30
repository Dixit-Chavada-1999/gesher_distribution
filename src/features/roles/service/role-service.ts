/**
 * Role Service
 *
 * Business logic for Role management.
 */

import { ValidationError, ConflictError } from '@/shared/lib/errors';
import { auditService } from '@/shared/lib/audit';
import { logger } from '@/shared/lib/logger';
import { roleRepository } from '../repository';
import type {
  Role,
  CreateRoleData,
  UpdateRoleData,
  RoleWithPermissions,
  RoleQueryFilters,
  RoleListItem,
  RoleDetail,
} from '../types';

/**
 * Service context for operations
 */
export interface ServiceContext {
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

class RoleServiceImpl {
  private readonly serviceName = 'RoleService';

  /**
   * Validate role creation data
   */
  private async validateCreate(data: CreateRoleData): Promise<void> {
    if (!data.name?.trim()) {
      throw ValidationError.required('name');
    }

    if (!data.slug?.trim()) {
      throw ValidationError.required('slug');
    }

    if (!data.displayName?.trim()) {
      throw ValidationError.required('displayName');
    }

    // Validate slug format (lowercase, alphanumeric, underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(data.slug)) {
      throw ValidationError.field(
        'slug',
        'Slug must start with a letter and contain only lowercase letters, numbers, and underscores'
      );
    }

    // Check slug uniqueness
    const isUnique = await roleRepository.isSlugUnique(data.slug);
    if (!isUnique) {
      throw ConflictError.duplicate('slug', data.slug);
    }

    // Validate level range
    if (data.level !== undefined && (data.level < 0 || data.level > 100)) {
      throw ValidationError.field('level', 'Level must be between 0 and 100');
    }
  }

  /**
   * Validate role update data
   */
  private async validateUpdate(id: string, data: UpdateRoleData): Promise<void> {
    // Check if role exists and is not system role
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    if (existing.isSystem && (data.name || data.level !== undefined)) {
      throw ValidationError.field('role', 'Cannot modify name or level of system roles');
    }

    // Validate level range
    if (data.level !== undefined && (data.level < 0 || data.level > 100)) {
      throw ValidationError.field('level', 'Level must be between 0 and 100');
    }
  }

  /**
   * Get all roles with counts
   */
  async getAllRoles(filters?: RoleQueryFilters): Promise<RoleListItem[]> {
    return roleRepository.findAllWithCounts(filters);
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(id: string): Promise<RoleDetail | null> {
    const role = await roleRepository.findByIdWithPermissions(id);
    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      displayName: role.displayName,
      description: role.description,
      level: role.level,
      isSystem: role.isSystem,
      userCount: role._count?.users ?? 0,
      permissionCount: role.rolePermissions.length,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  /**
   * Get role by slug
   */
  async getRoleBySlug(slug: string): Promise<Role | null> {
    return roleRepository.findBySlug(slug);
  }

  /**
   * Create a new role
   */
  async createRole(data: CreateRoleData, ctx?: ServiceContext): Promise<RoleWithPermissions> {
    logger.info(`${this.serviceName}.createRole`, { userId: ctx?.userId });

    // Validate
    await this.validateCreate(data);

    // Create role with permissions
    const role = await roleRepository.createWithPermissions(data, ctx?.userId);

    // Audit log
    await auditService.logCreate(
      'roles',
      'Role',
      role.id,
      {
        name: role.name,
        slug: role.slug,
        displayName: role.displayName,
        level: role.level,
        permissionCount: role.rolePermissions.length,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Update a role
   */
  async updateRole(
    id: string,
    data: UpdateRoleData,
    ctx?: ServiceContext
  ): Promise<RoleWithPermissions> {
    logger.info(`${this.serviceName}.updateRole`, { id, userId: ctx?.userId });

    // Get existing role
    const existing = await roleRepository.findByIdWithPermissions(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    // Validate
    await this.validateUpdate(id, data);

    // Update role with permissions
    const role = await roleRepository.updateWithPermissions(id, data, ctx?.userId);

    // Audit log
    await auditService.logUpdate(
      'roles',
      'Role',
      role.id,
      {
        name: existing.name,
        displayName: existing.displayName,
        level: existing.level,
        permissionCount: existing.rolePermissions.length,
      },
      {
        name: role.name,
        displayName: role.displayName,
        level: role.level,
        permissionCount: role.rolePermissions.length,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Delete a role (soft delete)
   */
  async deleteRole(id: string, ctx?: ServiceContext): Promise<Role> {
    logger.info(`${this.serviceName}.deleteRole`, { id, userId: ctx?.userId });

    // Get existing role
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    // Check if system role
    if (existing.isSystem) {
      throw ValidationError.field('role', 'Cannot delete system roles');
    }

    // Check if role has users
    const hasUsers = await roleRepository.hasUsers(id);
    if (hasUsers) {
      throw ValidationError.field(
        'role',
        'Cannot delete role with assigned users. Please reassign users first.'
      );
    }

    // Soft delete
    const role = await roleRepository.delete(id, ctx?.userId);

    // Audit log
    await auditService.logDelete(
      'roles',
      'Role',
      role.id,
      {
        name: role.name,
        slug: role.slug,
        displayName: role.displayName,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(roleId: string): Promise<string[]> {
    return roleRepository.getPermissions(roleId);
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(_userId: string, _permissionName: string): Promise<boolean> {
    // This would typically check the user's role and its permissions
    // For now, return false - will be implemented when we integrate with user service
    return false;
  }

  /**
   * Generate slug from name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }
}

export const roleService = new RoleServiceImpl();
export { RoleServiceImpl };
