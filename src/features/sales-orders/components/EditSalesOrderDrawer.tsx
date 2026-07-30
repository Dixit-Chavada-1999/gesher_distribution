'use client';

/**
 * EditSalesOrderModal Component
 *
 * Modal for editing an existing sales order.
 * Fetches order data and pre-fills the form.
 * Only draft and pending orders can be edited.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

import { SalesOrderForm } from './SalesOrderForm';
import { getSalesOrder, updateSalesOrderItems } from '../actions';
import { orderToFormValues, formToCreateDTO } from '../lib/schemas';
import type { SalesOrderWithItems, SalesOrderMasterData } from '../types';

// ============================================
// TYPES
// ============================================

interface EditSalesOrderDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (order: SalesOrderWithItems) => void;
  masterData: SalesOrderMasterData;
}

// ============================================
// COMPONENT
// ============================================

export function EditSalesOrderDrawer({
  orderId,
  open,
  onClose,
  onSuccess,
  masterData,
}: EditSalesOrderDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [order, setOrder] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  useEffect(() => {
    if (open && orderId) {
      fetchOrder();
    } else {
      setOrder(null);
      setError(null);
    }
  }, [open, orderId]);

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchOrder = async () => {
    if (!orderId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSalesOrder(orderId);
      if (result.success && result.data) {
        // Check if order can be edited
        if (!['draft', 'pending'].includes(result.data.status)) {
          setError(`Cannot edit order in "${result.data.status}" status. Only draft and pending orders can be edited.`);
          setOrder(null);
        } else {
          setOrder(result.data);
        }
      } else {
        setError(result.error || 'Failed to load order');
      }
    } catch {
      setError('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCancel = () => {
    if (isSubmitting) {return;}
    onClose();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdate = async (formData: any) => {
    if (!orderId || !order) {return;}

    setIsSubmitting(true);

    try {
      // Convert form data to DTO
      const dto = formToCreateDTO(formData);

      // Update order items
      const result = await updateSalesOrderItems(orderId, dto.items);

      if (result.success && result.data) {
        toast.success(`Order ${result.data.orderNumber} updated successfully`);
        onSuccess?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'Failed to update order');
      }
    } catch (err) {
      console.error('Update order error:', err);
      toast.error('Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  // Convert order to form values
  const initialFormData = order ? orderToFormValues({
    orderDate: new Date(order.orderDate),
    requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : null,
    customerId: order.customerId,
    salesRepId: order.salesRepId,
    warehouseId: order.warehouseId,
    currencyCode: order.currencyCode,
    customerPoNumber: order.customerPoNumber,
    status: order.status,
    billingAddressStreet: order.billingAddressStreet,
    billingAddressCity: order.billingAddressCity,
    billingAddressState: order.billingAddressState,
    billingAddressPostalCode: order.billingAddressPostalCode,
    billingAddressCountry: order.billingAddressCountry,
    shippingAddressStreet: order.shippingAddressStreet,
    shippingAddressCity: order.shippingAddressCity,
    shippingAddressState: order.shippingAddressState,
    shippingAddressPostalCode: order.shippingAddressPostalCode,
    shippingAddressCountry: order.shippingAddressCountry,
    shippingMethod: order.shippingMethod,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unitCode: item.unitCode,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      warehouseId: item.warehouseId,
      batchNumber: item.batchNumber,
      serialNumber: item.serialNumber,
    })),
  }) : undefined;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-6xl flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${order?.orderNumber || 'Order'}`}
          </DialogTitle>
          <DialogDescription>
            {order?.customer?.name || 'Update order information'}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Alert variant="destructive" className="max-w-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={fetchOrder} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : order && initialFormData ? (
              <SalesOrderForm
                masterData={masterData}
                initialData={initialFormData}
                onSubmit={handleUpdate}
                onCancel={handleCancel}
              />
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {order && !isLoading && !error && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="sales-order-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
