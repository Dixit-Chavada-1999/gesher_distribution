'use client';

/**
 * Roles Page Content
 *
 * Client component for roles management with dynamic data.
 * Grid-based card layout for roles with inline permissions editor.
 *
 * Performance Optimizations:
 * - Uses React.memo for sub-components
 * - Memoized callbacks with useCallback
 * - Memoized computed values with useMemo
 */

import { memo, useState, useMemo, useCallback } from 'react';
import { PageHeader } from '@/shared/components/layout';
import {
  Card,
  CardContent,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Key, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useRoles,
  useRole,
  usePermissions,
  useDeleteRole,
} from '@/features/roles/hooks';
import { useUpdateRole } from '@/features/roles/hooks/use-role-mutations';
import { RoleFormDialog } from '@/features/roles/components';
import type { RoleListItem, Permission, PermissionGroup as PermissionGroupType } from '@/features/roles/types';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

// ============================================
// ROLE CARD COMPONENT (Memoized)
// ============================================

interface RoleCardProps {
  role: RoleListItem;
  isSelected: boolean;
  onCardClick: (role: RoleListItem) => void;
  onEditClick: (role: RoleListItem) => void;
  onDeleteClick: (role: RoleListItem, e: React.MouseEvent) => void;
}

const RoleCard = memo(function RoleCard({
  role,
  isSelected,
  onCardClick,
  onEditClick,
  onDeleteClick,
}: RoleCardProps) {
  const handleCardClick = useCallback(() => {
    onCardClick(role);
  }, [onCardClick, role]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick(role);
  }, [onEditClick, role]);

  const handleDeleteClickInternal = useCallback((e: React.MouseEvent) => {
    onDeleteClick(role, e);
  }, [onDeleteClick, role]);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        {/* Header Row - Slug & Actions */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-foreground">
            {role.slug}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleEditClick}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleDeleteClickInternal}
              disabled={role.isSystem}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Display Name / Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {role.displayName}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{role.userCount}</span>
            {' '}Users
          </span>
          <span>
            <span className="font-medium text-foreground">{role.permissionCount}</span>
            {' '}Permissions
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================
// PERMISSION ROW COMPONENT (Memoized)
// ============================================

interface PermissionRowProps {
  permission: Permission;
  isEnabled: boolean;
  isUpdating: boolean;
  onToggle: (permission: Permission, isEnabled: boolean) => void;
}

const PermissionRow = memo(function PermissionRow({
  permission,
  isEnabled,
  isUpdating,
  onToggle,
}: PermissionRowProps) {
  const handleToggle = useCallback((checked: boolean) => {
    onToggle(permission, checked);
  }, [onToggle, permission]);

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors border-b last:border-b-0">
      <div className="flex items-center gap-3 pl-8">
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isUpdating}
          className="data-[state=checked]:bg-green-500"
        />
        <div>
          <p className="text-sm font-medium">{permission.displayName}</p>
          {permission.description && (
            <p className="text-xs text-muted-foreground">{permission.description}</p>
          )}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-xs',
          isEnabled ? 'bg-green-50 text-green-700 border-green-200' : ''
        )}
      >
        {permission.action}
      </Badge>
    </div>
  );
});

// ============================================
// PERMISSION MODULE COMPONENT (Memoized)
// ============================================

interface PermissionModuleProps {
  group: PermissionGroupType;
  counts: { enabled: number; total: number };
  isExpanded: boolean;
  selectedRolePermissionIds: Set<string>;
  isUpdating: boolean;
  onToggleModule: (module: string) => void;
  onPermissionToggle: (permission: Permission, isEnabled: boolean) => void;
}

const PermissionModule = memo(function PermissionModule({
  group,
  counts,
  isExpanded,
  selectedRolePermissionIds,
  isUpdating,
  onToggleModule,
  onPermissionToggle,
}: PermissionModuleProps) {
  const handleToggle = useCallback(() => {
    onToggleModule(group.module);
  }, [onToggleModule, group.module]);

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={handleToggle}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-amber-500" />
                <span className="font-medium">{group.module}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    counts.enabled === counts.total && counts.total > 0
                      ? 'bg-green-100 text-green-700'
                      : counts.enabled > 0
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {counts.enabled}/{counts.total}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            {group.permissions.map((permission) => (
              <PermissionRow
                key={permission.id}
                permission={permission}
                isEnabled={selectedRolePermissionIds.has(permission.id)}
                isUpdating={isUpdating}
                onToggle={onPermissionToggle}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function RolesPageContentComponent() {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null); // Separate state for dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleListItem | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const { roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles();

  // Auto-select first role (super_admin) on initial load
  const firstRole = roles[0];
  if (!hasAutoSelected && !rolesLoading && roles.length > 0 && firstRole && !selectedRoleId) {
    setSelectedRoleId(firstRole.id);
    setHasAutoSelected(true);
  }
  const { role: selectedRole, loading: roleLoading, refetch: refetchRole } = useRole(selectedRoleId);
  const { role: editingRole } = useRole(editingRoleId); // For dialog
  const { permissions: permissionGroups, loading: permissionsLoading } = usePermissions();
  const { deleteRole, loading: deletingRole } = useDeleteRole();
  const { updateRole, loading: updatingRole } = useUpdateRole();

  // Get selected role's permission IDs as a Set for quick lookup
  const selectedRolePermissionIds = useMemo(() => {
    if (!selectedRole?.permissions) {return new Set<string>();}
    return new Set(selectedRole.permissions.map(p => p.id));
  }, [selectedRole]);

  const handleCreateRole = useCallback(() => {
    setEditingRoleId(null); // null means create mode
    setDialogOpen(true);
  }, []);

  const handleEditRole = useCallback((role: RoleListItem) => {
    setEditingRoleId(role.id); // Set the role to edit
    setDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((role: RoleListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  }, []);

  const handleCardClick = useCallback((role: RoleListItem) => {
    setSelectedRoleId(prev => role.id === prev ? null : role.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!roleToDelete) {
      return;
    }

    try {
      await deleteRole(roleToDelete.id);
      toast.success('Role deleted successfully');
      if (selectedRoleId === roleToDelete.id) {
        setSelectedRoleId(null);
      }
      refetchRoles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete role');
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  }, [roleToDelete, deleteRole, selectedRoleId, refetchRoles]);

  const handleDialogSuccess = useCallback(() => {
    refetchRoles();
    if (selectedRoleId) {
      refetchRole();
    }
    toast.success(editingRoleId ? 'Role updated successfully' : 'Role created successfully');
  }, [refetchRoles, selectedRoleId, refetchRole, editingRoleId]);

  const toggleModule = useCallback((module: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }, []);

  const handlePermissionToggle = useCallback(async (permission: Permission, isEnabled: boolean) => {
    if (!selectedRole || !selectedRoleId) {return;}

    try {
      const currentPermissionIds = selectedRole.permissions.map(p => p.id);
      let newPermissionIds: string[];

      if (isEnabled) {
        // Add permission
        newPermissionIds = [...currentPermissionIds, permission.id];
      } else {
        // Remove permission
        newPermissionIds = currentPermissionIds.filter(id => id !== permission.id);
      }

      await updateRole(selectedRoleId, { permissionIds: newPermissionIds });
      await refetchRole();
      refetchRoles(); // Update permission count in the card
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update permission');
    }
  }, [selectedRole, selectedRoleId, updateRole, refetchRole, refetchRoles]);

  // Calculate permission counts per module for the selected role
  const modulePermissionCounts = useMemo(() => {
    const counts: Record<string, { enabled: number; total: number }> = {};

    for (const group of permissionGroups) {
      const enabled = group.permissions.filter(p => selectedRolePermissionIds.has(p.id)).length;
      counts[group.module] = {
        enabled,
        total: group.permissions.length,
      };
    }

    return counts;
  }, [permissionGroups, selectedRolePermissionIds]);

  // Find selected role from list
  const selectedRoleFromList = roles.find(r => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and configure access permissions"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Roles' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetchRoles()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={handleCreateRole}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </div>
        }
      />

      {/* Error State */}
      {rolesError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{rolesError}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetchRoles()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State - Grid Skeleton */}
      {rolesLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
              <Skeleton className="h-4 w-32 mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Roles Grid */}
      {!rolesLoading && !rolesError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No roles found</p>
                <Button onClick={handleCreateRole}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Role
                </Button>
              </CardContent>
            </Card>
          ) : (
            roles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isSelected={selectedRoleId === role.id}
                onCardClick={handleCardClick}
                onEditClick={handleEditRole}
                onDeleteClick={handleDeleteClick}
              />
            ))
          )}
        </div>
      )}

      {/* Permissions Section - Shows when a role is selected */}
      {selectedRoleId && selectedRoleFromList && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold">
              Permissions for:{' '}
              <span className="text-primary">{selectedRoleFromList.slug}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Toggle permissions on or off for this role. Changes affect all users holding this role.
            </p>
          </div>

          {/* Loading State for Permissions */}
          {(roleLoading || permissionsLoading) && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Permission Groups */}
          {!roleLoading && !permissionsLoading && permissionGroups.length > 0 && (
            <div className="space-y-3">
              {permissionGroups.map((group) => (
                <PermissionModule
                  key={group.module}
                  group={group}
                  counts={modulePermissionCounts[group.module] || { enabled: 0, total: 0 }}
                  isExpanded={expandedModules.has(group.module)}
                  selectedRolePermissionIds={selectedRolePermissionIds}
                  isUpdating={updatingRole}
                  onToggleModule={toggleModule}
                  onPermissionToggle={handlePermissionToggle}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!roleLoading && !permissionsLoading && permissionGroups.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No permissions available.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Role Form Dialog */}
      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={editingRole}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role &ldquo;{roleToDelete?.displayName}&rdquo;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingRole}
            >
              {deletingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Export memoized component
export const RolesPageContent = memo(RolesPageContentComponent);
