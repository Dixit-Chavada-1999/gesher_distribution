'use client';

/**
 * Shipments Page
 *
 * Main page for managing shipments.
 */

import { useState, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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

import {
  ShipmentsTable,
  ViewShipmentDrawer,
  useShipments,
} from '@/features/shipments';
import { deleteShipment } from '@/features/shipments/actions';
import type { ShipmentListItem, ShipmentStatus, ShipmentWithItems } from '@/features/shipments/types';
import { SHIPMENT_STATUS_LABELS } from '@/features/shipments/types';

export default function ShipmentsPage() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<ShipmentListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  const {
    data: shipments,
    isLoading: isShipmentsLoading,
    refetch: refetchShipments,
  } = useShipments(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCreateClick = () => {
    toast.info('Create shipment functionality coming soon');
  };

  const handleView = useCallback((shipment: ShipmentListItem) => {
    setSelectedShipmentId(shipment.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedShipmentId(null);
  }, []);

  const handleEdit = useCallback((_shipment: ShipmentListItem | ShipmentWithItems) => {
    toast.info('Edit shipment functionality coming soon');
  }, []);

  const handleDeleteClick = useCallback((shipment: ShipmentListItem) => {
    setShipmentToDelete(shipment);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!shipmentToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteShipment(shipmentToDelete.id);
      if (result.success) {
        toast.success(`Shipment ${shipmentToDelete.shipmentNumber} deleted`);
        refetchShipments();
      } else {
        toast.error(result.error || 'Failed to delete shipment');
      }
    } catch {
      toast.error('Failed to delete shipment');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setShipmentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setShipmentToDelete(null);
  };

  const handleRowClick = useCallback((shipment: ShipmentListItem) => {
    handleView(shipment);
  }, [handleView]);

  const handleRefresh = () => {
    refetchShipments();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as ShipmentStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Shipments"
        description="Track and manage shipments."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isShipmentsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isShipmentsLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create Shipment
            </Button>
          </div>
        }
      />

      {/* Shipments Table */}
      <ShipmentsTable
        data={shipments}
        isLoading={isShipmentsLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* View Shipment Drawer */}
      <ViewShipmentDrawer
        shipmentId={selectedShipmentId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shipment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete shipment{' '}
              <span className="font-semibold">{shipmentToDelete?.shipmentNumber}</span>?
              This action cannot be undone. Only pending shipments can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
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
    </div>
  );
}
