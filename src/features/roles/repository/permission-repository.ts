/**
 * Permission Repository
 *
 * Data access layer for Permission entity using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Permission,
  CreatePermissionData,
  UpdatePermissionData,
  PermissionQueryFilters,
  PermissionGroup,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

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

class PermissionRepositoryImpl {
  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<Permission | null> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return data ? this.mapToPermission(data as DbPermission) : null;
  }

  /**
   * Find permission by name
   */
  async findByName(name: string): Promise<Permission | null> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('name', name)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return data ? this.mapToPermission(data as DbPermission) : null;
  }

  /**
   * Find permissions by module
   */
  async findByModule(module: string): Promise<Permission[]> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('module', module)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return (data || []).map((p) => this.mapToPermission(p as DbPermission));
  }

  /**
   * Get all permissions grouped by module
   */
  async findAllGroupedByModule(): Promise<PermissionGroup[]> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .is('deleted_at', null)
      .order('module', { ascending: true })
      .order('action', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    const grouped: Record<string, Permission[]> = {};

    for (const permission of data || []) {
      const perm = this.mapToPermission(permission as DbPermission);
      const permModuleName = perm.module;
      if (!grouped[permModuleName]) {
        grouped[permModuleName] = [];
      }
      grouped[permModuleName].push(perm);
    }

    return Object.entries(grouped).map(([module, permissions]) => ({
      module,
      permissions,
    }));
  }

  /**
   * Get all permissions with filters
   */
  async findAllFiltered(filters?: PermissionQueryFilters): Promise<Permission[]> {
    let query = db
      .from('permissions')
      .select('*')
      .is('deleted_at', null);

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters?.module) {
      query = query.eq('module', filters.module);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    query = query.order('module', { ascending: true }).order('action', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return (data || []).map((p) => this.mapToPermission(p as DbPermission));
  }

  /**
   * Find all permissions
   */
  async findAll(): Promise<Permission[]> {
    return this.findAllFiltered();
  }

  /**
   * Get unique modules
   */
  async getModules(): Promise<string[]> {
    const { data, error } = await db
      .from('permissions')
      .select('module')
      .is('deleted_at', null)
      .order('module', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch modules: ${error.message}`);
    }

    // Get unique modules
    const modules = [...new Set((data || []).map((r) => r.module))];
    return modules;
  }

  /**
   * Get unique categories
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await db
      .from('permissions')
      .select('category')
      .is('deleted_at', null)
      .not('category', 'is', null)
      .order('category', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    // Get unique non-null categories
    const categories = [...new Set((data || []).filter((r) => r.category).map((r) => r.category as string))];
    return categories;
  }

  /**
   * Create a permission
   */
  async create(data: CreatePermissionData, createdBy?: string): Promise<Permission> {
    const { data: result, error } = await db
      .from('permissions')
      .insert({
        name: data.name,
        display_name: data.displayName,
        description: data.description ?? null,
        module: data.module,
        action: data.action,
        category: data.category ?? null,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create permission: ${error.message}`);
    }

    return this.mapToPermission(result as DbPermission);
  }

  /**
   * Create multiple permissions
   */
  async createMany(
    permissions: CreatePermissionData[],
    createdBy?: string
  ): Promise<number> {
    if (permissions.length === 0) {return 0;}

    const { data, error } = await db
      .from('permissions')
      .upsert(
        permissions.map((p) => ({
          name: p.name,
          display_name: p.displayName,
          description: p.description ?? null,
          module: p.module,
          action: p.action,
          category: p.category ?? null,
          created_by: createdBy ?? null,
        })),
        { onConflict: 'name', ignoreDuplicates: true }
      )
      .select();

    if (error) {
      throw new Error(`Failed to create permissions: ${error.message}`);
    }

    return data?.length ?? 0;
  }

  /**
   * Update a permission
   */
  async update(id: string, data: UpdatePermissionData, updatedBy?: string): Promise<Permission> {
    const updateData: Record<string, unknown> = {
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.displayName !== undefined) {updateData.display_name = data.displayName;}
    if (data.description !== undefined) {updateData.description = data.description;}
    if (data.category !== undefined) {updateData.category = data.category;}

    const { data: result, error } = await db
      .from('permissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update permission: ${error.message}`);
    }

    return this.mapToPermission(result as DbPermission);
  }

  /**
   * Delete a permission (soft delete)
   */
  async delete(id: string, deletedBy?: string): Promise<Permission> {
    const { data, error } = await db
      .from('permissions')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: deletedBy ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete permission: ${error.message}`);
    }

    return this.mapToPermission(data as DbPermission);
  }

  /**
   * Check if permission name is unique
   */
  async isNameUnique(name: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('permissions')
      .select('id', { count: 'exact', head: true })
      .eq('name', name)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check name: ${error.message}`);
    }

    return (count ?? 0) === 0;
  }

  /**
   * Get permissions for a role
   */
  async getByRoleId(roleId: string): Promise<Permission[]> {
    const { data, error } = await db
      .from('role_permissions')
      .select(`
        permissions:permission_id (*)
      `)
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to get permissions: ${error.message}`);
    }

    return (data || [])
      .filter((r) => r.permissions)
      .map((r) => {
        const perm = r.permissions as DbPermission | DbPermission[];
        const permData = Array.isArray(perm) ? perm[0] : perm;
        return permData ? this.mapToPermission(permData) : null;
      })
      .filter((p): p is Permission => p !== null);
  }

  /**
   * Get permission IDs for a role
   */
  async getIdsByRoleId(roleId: string): Promise<string[]> {
    const { data, error } = await db
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to get permission IDs: ${error.message}`);
    }

    return (data || []).map((rp) => rp.permission_id);
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

export const permissionRepository = new PermissionRepositoryImpl();
export { PermissionRepositoryImpl };
