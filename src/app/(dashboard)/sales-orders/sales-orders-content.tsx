'use client';

/**
 * Sales Orders Page Content
 *
 * Client component for managing sales orders.
 * Uses server actions to fetch real data.
 *
 * State Management:
 * - Page component owns drawer state
 * - Master data is fetched once via hook and shared
 * - Sales orders are fetched via useSalesOrders hook
 * - Data flows down via props
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
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
  SalesOrdersTable,
  CreateSalesOrderDrawer,
  ViewSalesOrderDrawer,
  EditSalesOrderDrawer,
  useSalesOrderMasterData,
  useSalesOrders,
} from '@/features/sales-orders';
import { deleteSalesOrder } from '@/features/sales-orders/actions';
import type { SalesOrderListItem, OrderStatus, OrderCreditStatus, SalesOrderWithItems } from '@/features/sales-orders/types';
import { ORDER_STATUS_LABELS, ORDER_CREDIT_STATUS_LABELS } from '@/features/sales-orders/types';

// ============================================
// COMPONENT
// ============================================

export function SalesOrdersPageContent() {
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('orders.create');
  const canViewDetail = hasMounted && hasPermission('orders.view_detail');
  const canEdit = hasMounted && hasPermission('orders.edit');
  const canDelete = hasMounted && hasPermission('orders.delete');
  // const canApprove = hasMounted && hasPermission('orders.approve'); // TODO: Use when approve feature is implemented

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrderListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [creditStatusFilter, setCreditStatusFilter] = useState<OrderCreditStatus | 'all'>('all');

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Master data hook - fetches once, caches, shares across components
  const { data: masterData } = useSalesOrderMasterData();

  // Sales orders list with status and credit status filters
  const {
    data: salesOrders,
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useSalesOrders({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(creditStatusFilter !== 'all' && { creditStatus: creditStatusFilter }),
  });


  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Create
  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
    refetchOrders();
  }, [refetchOrders]);

  // View
  const handleView = useCallback((order: SalesOrderListItem) => {
    setSelectedOrderId(order.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedOrderId(null);
  }, []);

  // Edit (can be triggered from view drawer or table actions)
  const handleEdit = useCallback((order: SalesOrderListItem | SalesOrderWithItems) => {
    setSelectedOrderId(order.id);
    setIsViewDrawerOpen(false);
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedOrderId(null);
    refetchOrders();
  }, [refetchOrders]);

  const handleEditSuccess = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedOrderId(null);
    refetchOrders();
    toast.success('Order updated successfully');
  }, [refetchOrders]);

  // Delete
  const handleDeleteClick = useCallback((order: SalesOrderListItem) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) {return;}

    setIsDeleting(true);
    try {
      const result = await deleteSalesOrder(orderToDelete.id);
      if (result.success) {
        toast.success(`Order ${orderToDelete.orderNumber} deleted`);
        refetchOrders();
      } else {
        toast.error(result.error || 'Failed to delete order');
      }
    } catch {
      toast.error('Failed to delete order');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  // Row click (opens view drawer)
  const handleRowClick = useCallback((order: SalesOrderListItem) => {
    handleView(order);
  }, [handleView]);

  const handleRefresh = () => {
    refetchOrders();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as OrderStatus | 'all');
  };

  const handleCreditStatusFilterChange = (value: string) => {
    setCreditStatusFilter(value as OrderCreditStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Sales Orders"
        description="Manage customer sales orders."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isOrdersLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isOrdersLoading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Create Sales Order
              </Button>
            )}
          </div>
        }
      />

      {/* Sales Orders Table */}
      <SalesOrdersTable
        data={salesOrders}
        isLoading={isOrdersLoading}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onView={canViewDetail ? handleView : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        toolbarContent={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={creditStatusFilter} onValueChange={handleCreditStatusFilterChange}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Credit</SelectItem>
                {Object.entries(ORDER_CREDIT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Create Sales Order Drawer */}
      <CreateSalesOrderDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        masterData={masterData}
      />

      {/* View Sales Order Drawer */}
      <ViewSalesOrderDrawer
        orderId={selectedOrderId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
      />

      {/* Edit Sales Order Drawer */}
      <EditSalesOrderDrawer
        orderId={selectedOrderId}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
        masterData={masterData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order{' '}
              <span className="font-semibold">{orderToDelete?.orderNumber}</span>?
              This action cannot be undone. Only draft orders can be deleted.
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
