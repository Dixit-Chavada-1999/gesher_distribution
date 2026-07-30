'use client';

/**
 * Role Form Dialog
 *
 * Dialog for creating and editing roles.
 * Only handles basic role info - permissions are managed separately on the main page.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useCreateRole, useUpdateRole } from '../hooks/use-role-mutations';
import type { RoleDetail, CreateRoleData, UpdateRoleData } from '../types';

// ============================================
// SCHEMA
// ============================================

const roleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Slug must start with a letter and contain only lowercase letters, numbers, and underscores'
    ),
  displayName: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
});

type RoleFormValues = {
  name: string;
  slug: string;
  displayName: string;
  description?: string;
};

// ============================================
// PROPS
// ============================================

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleDetail | null;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

function RoleFormDialogComponent({
  open,
  onOpenChange,
  role,
  onSuccess,
}: RoleFormDialogProps) {
  const isEditing = !!role;
  const [submitting, setSubmitting] = useState(false);

  const { createRole } = useCreateRole();
  const { updateRole } = useUpdateRole();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      displayName: '',
      description: '',
    },
  });

  // Reset form when role changes
  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        slug: role.slug,
        displayName: role.displayName,
        description: role.description || '',
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        displayName: '',
        description: '',
      });
    }
  }, [role, form]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
      form.setValue('slug', slug);
    }
  }, [watchName, isEditing, form]);

  const onSubmit = useCallback(async (values: RoleFormValues) => {
    try {
      setSubmitting(true);

      if (isEditing && role) {
        const updateData: UpdateRoleData = {
          name: values.name,
          displayName: values.displayName,
          description: values.description || undefined,
        };
        await updateRole(role.id, updateData);
      } else {
        const createData: CreateRoleData = {
          name: values.name,
          slug: values.slug,
          displayName: values.displayName,
          description: values.description || undefined,
        };
        await createRole(createData);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save role:', error);
    } finally {
      setSubmitting(false);
    }
  }, [isEditing, role, updateRole, createRole, onOpenChange, onSuccess]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update role details.'
              : 'Create a new role. You can assign permissions after creating.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Sales Manager"
                        disabled={role?.isSystem}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., sales_manager"
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormDescription>Unique identifier (auto-generated)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Display Name */}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Sales Manager" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe what this role can do..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Export memoized component
export const RoleFormDialog = memo(RoleFormDialogComponent);
