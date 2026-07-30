'use client';

/**
 * Locations Table Component
 *
 * Data table for displaying and managing locations.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { getLocationsTableColumns } from './LocationsTableColumns';
import type { LocationTableRow } from '../types';
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
import { toast } from 'sonner';
import { deleteLocation } from '../actions';

interface LocationsTableProps {
  data: LocationTableRow[];
  pageCount?: number;
  isLoading?: boolean;
}

export function LocationsTable({ data, pageCount = 1, isLoading = false }: LocationsTableProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleView = useCallback(
    (location: LocationTableRow) => {
      router.push(`/locations/${location.id}`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (location: LocationTableRow) => {
      router.push(`/locations/${location.id}/edit`);
    },
    [router]
  );

  const handleDeleteClick = useCallback((location: LocationTableRow) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteLocation(locationToDelete.id);

      if (result.success) {
        toast.success('Location deleted successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete location');
      }
    } catch {
      toast.error('An error occurred while deleting the location');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const columns = getLocationsTableColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        pageCount={pageCount}
        filterColumn="name"
        filterPlaceholder="Filter locations..."
        isLoading={isLoading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{locationToDelete?.name}</span>? This
              action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
