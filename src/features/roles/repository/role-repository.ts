/**
 * Role Repository
 *
 * Data access layer for Role entity using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Role,
  CreateRoleData,
  UpdateRoleData,
  RoleWithPermissions,
  RoleQueryFilters,
  RoleListItem,
  Permission,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbRole {
  id: string;
  name: string;
  slug: string;
  display_name: string;
  description: string | null;
  level: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbPermission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  module: string;
  action: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}


// ============================================
// REPOSITORY
// ============================================

class RoleRepositoryImpl {
  /**
   * Find role by ID
   */
  async findById(id: string): Promise<Role | null> {
    const { data, error } = await db
      .from('roles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch role: ${error.message}`);
    }

    return data ? this.mapToRole(data as DbRole) : null;
  }

  /**
   * Find role by slug
   */
  async findBySlug(slug: string): Promise<Role | null> {
    const { data, error } = await db
      .from('roles')
      .select('*')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch role: ${error.message}`);
    }

    return data ? this.mapToRole(data as DbRole) : null;
  }

  /**
   * Find role with permissions
   *
   * Uses parallel queries for permissions and user count.
   */
  async findByIdWithPermissions(id: string): Promise<RoleWithPermissions | null> {
    // Get role, permissions, and user count in PARALLEL
    const [roleResult, permsResult, countResult] = await Promise.all([
      db
        .from('roles')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single(),
      db
        .from('role_permissions')
        .select(`
          *,
          permissions:permission_id (*)
        `)
        .eq('role_id', id),
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', id)
        .is('deleted_at', null),
    ]);

    // Check for role errors
    if (roleResult.error) {
      if (roleResult.error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch role: ${roleResult.error.message}`);
    }

    if (!roleResult.data) {return null;}

    // Check for permissions error
    if (permsResult.error) {
      throw new Error(`Failed to fetch permissions: ${permsResult.error.message}`);
    }

    // Check for count error
    if (countResult.error) {
      throw new Error(`Failed to count users: ${countResult.error.message}`);
    }

    const role = this.mapToRole(roleResult.data as DbRole);

    return {
      ...role,
      rolePermissions: (permsResult.data || []).map((rp) => ({
        id: rp.id,
        roleId: rp.role_id,
        permissionId: rp.permission_id,
        createdAt: new Date(rp.created_at),
        createdBy: rp.created_by,
        permission: this.mapToPermission(rp.permissions as DbPermission),
      })),
      _count: {
        users: countResult.count ?? 0,
      },
    };
  }

  /**
   * Get all roles with user counts
   *
   * Uses efficient counting with parallel queries to avoid N+1 problems.
   */
  async findAllWithCounts(filters?: RoleQueryFilters): Promise<RoleListItem[]> {
    // Get all roles
    let query = db
      .from('roles')
      .select('*')
      .is('deleted_at', null);

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters?.isSystem !== undefined) {
      query = query.eq('is_system', filters.isSystem);
    }

    if (filters?.minLevel !== undefined) {
      query = query.gte('level', filters.minLevel);
    }

    if (filters?.maxLevel !== undefined) {
      query = query.lte('level', filters.maxLevel);
    }

    query = query.order('level', { ascending: false }).order('name', { ascending: true });

    const { data: rolesData, error: rolesError } = await query;

    if (rolesError) {
      throw new Error(`Failed to fetch roles: ${rolesError.message}`);
    }

    if (!rolesData || rolesData.length === 0) {
      return [];
    }

    // Get user counts and permission counts in PARALLEL
    const roleIds = rolesData.map((r) => r.id);

    const [userCountsResult, permCountsResult] = await Promise.all([
      db
        .from('users')
        .select('role_id')
        .in('role_id', roleIds)
        .is('deleted_at', null),
      db
        .from('role_permissions')
        .select('role_id')
        .in('role_id', roleIds),
    ]);

    if (userCountsResult.error) {
      throw new Error(`Failed to count users: ${userCountsResult.error.message}`);
    }

    if (permCountsResult.error) {
      throw new Error(`Failed to count permissions: ${permCountsResult.error.message}`);
    }

    // Build count maps
    const userCountMap: Record<string, number> = {};
    const permCountMap: Record<string, number> = {};

    (userCountsResult.data || []).forEach((row) => {
      userCountMap[row.role_id] = (userCountMap[row.role_id] || 0) + 1;
    });

    (permCountsResult.data || []).forEach((row) => {
      permCountMap[row.role_id] = (permCountMap[row.role_id] || 0) + 1;
    });

    return rolesData.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      displayName: role.display_name,
      description: role.description,
      level: role.level,
      isSystem: role.is_system,
      userCount: userCountMap[role.id] || 0,
      permissionCount: permCountMap[role.id] || 0,
      createdAt: new Date(role.created_at),
    }));
  }

  /**
   * Create role with permissions
   */
  async createWithPermissions(
    data: CreateRoleData,
    createdBy?: string
  ): Promise<RoleWithPermissions> {
    const { permissionIds, ...roleData } = data;

    // Create role
    const { data: newRole, error: createError } = await db
      .from('roles')
      .insert({
        name: roleData.name,
        slug: roleData.slug,
        display_name: roleData.displayName,
        description: roleData.description ?? null,
        level: roleData.level ?? 0,
        is_system: roleData.isSystem ?? false,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create role: ${createError.message}`);
    }

    // Add permissions if provided
    if (permissionIds && permissionIds.length > 0) {
      const { error: permsError } = await db
        .from('role_permissions')
        .insert(
          permissionIds.map((permissionId) => ({
            role_id: newRole.id,
            permission_id: permissionId,
            created_by: createdBy ?? null,
          }))
        );

      if (permsError) {
        throw new Error(`Failed to add permissions: ${permsError.message}`);
      }
    }

    const result = await this.findByIdWithPermissions(newRole.id);
    if (!result) {
      throw new Error('Failed to retrieve created role');
    }
    return result;
  }

  /**
   * Update role with permissions
   */
  async updateWithPermissions(
    id: string,
    data: UpdateRoleData,
    updatedBy?: string
  ): Promise<RoleWithPermissions> {
    const { permissionIds, ...roleData } = data;

    // If permissionIds provided, sync permissions
    if (permissionIds !== undefined) {
      // Delete existing permissions
      const { error: deleteError } = await db
        .from('role_permissions')
        .delete()
        .eq('role_id', id);

      if (deleteError) {
        throw new Error(`Failed to delete permissions: ${deleteError.message}`);
      }

      // Add new permissions
      if (permissionIds.length > 0) {
        const { error: insertError } = await db
          .from('role_permissions')
          .insert(
            permissionIds.map((permissionId) => ({
              role_id: id,
              permission_id: permissionId,
              created_by: updatedBy ?? null,
            }))
          );

        if (insertError) {
          throw new Error(`Failed to add permissions: ${insertError.message}`);
        }
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    };

    if (roleData.name !== undefined) {updateData.name = roleData.name;}
    if (roleData.displayName !== undefined) {updateData.display_name = roleData.displayName;}
    if (roleData.description !== undefined) {updateData.description = roleData.description;}
    if (roleData.level !== undefined) {updateData.level = roleData.level;}

    // Update role
    const { error: updateError } = await db
      .from('roles')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      throw new Error(`Failed to update role: ${updateError.message}`);
    }

    const result = await this.findByIdWithPermissions(id);
    if (!result) {
      throw new Error('Failed to retrieve updated role');
    }
    return result;
  }

  /**
   * Delete role (soft delete)
   */
  async delete(id: string, deletedBy?: string): Promise<Role> {
    const { data, error } = await db
      .from('roles')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: deletedBy ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete role: ${error.message}`);
    }

    return this.mapToRole(data as DbRole);
  }

  /**
   * Check if role has users assigned
   */
  async hasUsers(id: string): Promise<boolean> {
    const { count, error } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to count users: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get role permissions
   */
  async getPermissions(roleId: string): Promise<string[]> {
    const { data, error } = await db
      .from('role_permissions')
      .select('permissions:permission_id (name)')
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to get permissions: ${error.message}`);
    }

    return (data || []).map((r) => {
      const perm = r.permissions as { name: string } | { name: string }[] | null;
      if (Array.isArray(perm)) {return perm[0]?.name;}
      return perm?.name;
    }).filter((name): name is string => Boolean(name));
  }

  /**
   * Check if slug is unique
   */
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check slug: ${error.message}`);
    }

    return (count ?? 0) === 0;
  }

  /**
   * Map database row to Role type
   */
  private mapToRole(data: DbRole): Role {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      displayName: data.display_name,
      description: data.description,
      level: data.level,
      isSystem: data.is_system,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  /**
   * Map database row to Permission type
   */
  private mapToPermission(data: DbPermission): Permission {
    return {
      id: data.id,
      name: data.name,
      displayName: data.display_name,
      description: data.description,
      module: data.module,
      action: data.action,
      category: data.category,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }
}

export const roleRepository = new RoleRepositoryImpl();
export { RoleRepositoryImpl };
