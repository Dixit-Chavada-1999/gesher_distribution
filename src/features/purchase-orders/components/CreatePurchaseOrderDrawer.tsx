'use client';

/**
 * Create Purchase Order Drawer
 *
 * Drawer component for creating new purchase orders.
 * Includes supplier selection dropdown.
 */

import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';

import { poFormSchema } from '../lib/schemas';
import { createPurchaseOrder, getSuppliersForDropdown } from '../actions';
import type { SupplierSummary, CreatePOItemDTO } from '../types';

// ============================================
// TYPES
// ============================================

interface CreatePurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Pre-filled items (e.g., from Sales Order)
  defaultItems?: CreatePOItemDTO[];
  defaultSalesOrderId?: string;
}

// ============================================
// COMPONENT
// ============================================

export function CreatePurchaseOrderDrawer({
  open,
  onClose,
  onSuccess,
  defaultItems = [],
  defaultSalesOrderId,
}: CreatePurchaseOrderDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);
  const [items, setItems] = useState<CreatePOItemDTO[]>(defaultItems);

  // Track selected supplier for auto-assigning to items
  const [supplierIdForItems, setSupplierIdForItems] = useState<string>('');

  const form = useForm({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      poDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      salesOrderId: defaultSalesOrderId || '',
      warehouseId: '',
      currencyCode: 'USD',
      vendorAddressStreet: '',
      vendorAddressCity: '',
      vendorAddressState: '',
      vendorAddressPostalCode: '',
      vendorAddressCountry: '',
      shipToAddressStreet: '',
      shipToAddressCity: '',
      shipToAddressState: '',
      shipToAddressPostalCode: '',
      shipToAddressCountry: '',
      shippingCost: 0,
      vendorNotes: '',
      internalNotes: '',
    },
  });

  // Load suppliers on mount
  useEffect(() => {
    if (open) {
      loadSuppliers();
    }
  }, [open]);

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true);
    try {
      const data = await getSuppliersForDropdown();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    setSupplierIdForItems(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    setSelectedSupplier(supplier || null);

    // Auto-fill vendor address if we have supplier info (would need to fetch full supplier data)
    // For now, just set the supplier
  };

  const onSubmit = async (data: Record<string, unknown>) => {
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    startTransition(async () => {
      try {
        // If PO-level supplier is selected and items don't have supplier, assign it
        const itemsWithSupplier = items.map((item) => {
          if (!item.supplierId && selectedSupplier) {
            return {
              ...item,
              supplierId: selectedSupplier.id,
              supplierName: selectedSupplier.name,
            };
          }
          return item;
        });

        const result = await createPurchaseOrder({
          poDate: new Date(data.poDate as string),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate as string)
            : null,
          salesOrderId: (data.salesOrderId as string) || null,
          warehouseId: (data.warehouseId as string) || null,
          currencyCode: (data.currencyCode as string) || 'USD',
          status: 'draft',
          vendorAddress: {
            street: (data.vendorAddressStreet as string) || null,
            city: (data.vendorAddressCity as string) || null,
            state: (data.vendorAddressState as string) || null,
            postalCode: (data.vendorAddressPostalCode as string) || null,
            country: (data.vendorAddressCountry as string) || null,
          },
          shipToAddress: {
            street: (data.shipToAddressStreet as string) || null,
            city: (data.shipToAddressCity as string) || null,
            state: (data.shipToAddressState as string) || null,
            postalCode: (data.shipToAddressPostalCode as string) || null,
            country: (data.shipToAddressCountry as string) || null,
          },
          items: itemsWithSupplier, // Supplier info is on items
          vendorNotes: (data.vendorNotes as string) || null,
          internalNotes: (data.internalNotes as string) || null,
        });

        if (result.success) {
          toast.success('Purchase Order created successfully');
          form.reset();
          setItems([]);
          setSelectedSupplier(null);
          await onSuccess?.();
          onClose();
        } else {
          toast.error(result.error || 'Failed to create Purchase Order');
        }
      } catch (error) {
        console.error('Error creating PO:', error);
        toast.error('Failed to create Purchase Order');
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      form.reset();
      setItems([]);
      setSelectedSupplier(null);
      setSupplierIdForItems('');
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Purchase Order</SheetTitle>
          <SheetDescription>
            Create a new purchase order to a supplier.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            {/* Supplier Selection (for auto-assigning to items) */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Default Supplier</h3>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Select a supplier to auto-assign to items without a supplier
                </label>
                <Select
                  value={supplierIdForItems}
                  onValueChange={handleSupplierChange}
                  disabled={isLoadingSuppliers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingSuppliers ? 'Loading...' : 'Select a supplier'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.primaryContactName && (
                          <span className="text-muted-foreground ml-2">
                            ({supplier.primaryContactName})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* PO Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Order Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="poDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Items</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info('Add item functionality coming soon')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No items added yet. Click &quot;Add Item&quot; to add products.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const isServiceOrNonInventory = item.itemType === 'service' || item.itemType === 'non_inventory';
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{item.sku}</p>
                          <p className="text-sm text-muted-foreground">
                            {isServiceOrNonInventory
                              ? `@ ${(item.unitPrice / 100).toFixed(2)}`
                              : `Qty: ${item.quantityOrdered} @ ${(item.unitPrice / 100).toFixed(2)}`
                            }
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setItems(items.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Notes</h3>
              <FormField
                control={form.control}
                name="vendorNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes for Supplier</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notes visible to supplier..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="internalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Internal notes (not visible to supplier)..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || items.length === 0}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Purchase Order
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
