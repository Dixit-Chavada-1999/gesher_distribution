/**
 * EditAllocationDialog Component
 *
 * Dialog for editing an existing fulfillment allocation.
 * Allows updating quantity, status, and notes.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  updateFulfillmentAllocationSchema,
  type UpdateFulfillmentAllocationInput,
} from '@/features/sales-orders/validations/fulfillment-allocation.schema';
import { updateAllocationAction } from '@/features/sales-orders/actions/fulfillment-allocation.actions';
import type { FulfillmentAllocationWithDetails, FulfillmentSource, AllocationStatus } from '@/features/sales-orders/types';

// ============================================
// TYPES
// ============================================

interface EditAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: FulfillmentAllocationWithDetails;
  productId: string;
  remainingToAllocate: number;
  onSuccess: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSourceLabel(source: FulfillmentSource): string {
  const labels: Record<FulfillmentSource, string> = {
    direct: 'Manufacturer (Direct)',
    gdc_inventory: 'GDC Inventory',
    platinum_dealer_inventory: 'Dealer Inventory',
    platinum_dealer_fulfillment: 'Dealer Fulfillment',
  };
  return labels[source];
}

// ============================================
// COMPONENT
// ============================================

export function EditAllocationDialog({
  open,
  onOpenChange,
  allocation,
  productId,
  remainingToAllocate,
  onSuccess,
}: EditAllocationDialogProps) {

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [inventoryInfo, setInventoryInfo] = useState<{
    onHand: number;
    allocated: number;
    available: number;
    loading: boolean;
  } | null>(null);

  // Calculate max quantity (current + remaining)
  const maxQuantity = allocation.quantity + remainingToAllocate;

  // Form
  const form = useForm<UpdateFulfillmentAllocationInput>({
    resolver: zodResolver(updateFulfillmentAllocationSchema),
    defaultValues: {
      quantity: allocation.quantity,
      status: allocation.status as AllocationStatus,
      notes: allocation.notes || '',
      containerQty: allocation.containerQty || undefined,
      containerId: allocation.containerId || undefined,
      locationId: allocation.locationId || undefined,
    },
  });

  // Watch fields for manufacturer (direct) remaining calculation
  const watchedQuantity = form.watch('quantity');
  const watchedContainerQty = form.watch('containerQty');
  const watchedLocationId = form.watch('locationId' as any);

  // Calculate remaining units for manufacturer (direct)
  const remainingContainerQty =
    allocation.fulfillmentSource === 'direct' && watchedContainerQty && watchedQuantity
      ? watchedContainerQty - watchedQuantity
      : 0;

  // Reset form when allocation changes
  useEffect(() => {
    if (open) {
      form.reset({
        quantity: allocation.quantity,
        status: allocation.status as AllocationStatus,
        notes: allocation.notes || '',
        containerQty: allocation.containerQty || undefined,
        containerId: allocation.containerId || undefined,
        locationId: allocation.locationId || undefined,
      });
    }
  }, [open, allocation, form]);

  // Load locations when manufacturer (direct) has remaining qty
  useEffect(() => {
    if (open && allocation.fulfillmentSource === 'direct' && remainingContainerQty > 0 && locations.length === 0) {
      loadLocations();
    }
  }, [open, allocation.fulfillmentSource, remainingContainerQty]);

  // Load inventory when location selected
  useEffect(() => {
    if (allocation.fulfillmentSource === 'direct' && remainingContainerQty > 0 && watchedLocationId) {
      loadInventory(watchedLocationId);
    } else if (allocation.fulfillmentSource === 'direct' && remainingContainerQty === 0) {
      setInventoryInfo(null);
    }
  }, [watchedLocationId, allocation.fulfillmentSource, remainingContainerQty]);

  // ============================================
  // DATA FETCHING
  // ============================================

  async function loadLocations() {
    try {
      setLoadingLocations(true);
      const { getAllLocationsAction } = await import('@/features/locations/actions');
      const result = await getAllLocationsAction({ type: 'warehouse' });

      if (result.success && result.data) {
        setLocations(
          result.data.map((loc) => ({
            id: loc.id,
            name: `${loc.locationCode} - ${loc.name}`,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadInventory(locationId: string) {
    try {
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: true });

      const { getInventoryByProductAndLocation } = await import('@/features/inventory/actions');
      const result = await getInventoryByProductAndLocation(productId, locationId);

      if (result.success && result.data) {
        setInventoryInfo({
          onHand: result.data.onHand,
          allocated: result.data.allocated,
          available: result.data.onHand - result.data.allocated,
          loading: false,
        });
      } else {
        setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  async function onSubmit(data: UpdateFulfillmentAllocationInput) {
    try {
      setIsSubmitting(true);

      const result = await updateAllocationAction(allocation.id, data, productId);

      if (result.success) {
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to update allocation');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    form.reset();
    onOpenChange(false);
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Allocation</DialogTitle>
          <DialogDescription>
            Update the allocation quantity, status, or notes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Source Info (Read-only) */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fulfillment Source</span>
                <Badge>{getSourceLabel(allocation.fulfillmentSource)}</Badge>
              </div>
              {allocation.location?.name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Location</span>
                  <span className="text-sm text-muted-foreground">
                    {allocation.location.name}
                  </span>
                </div>
              )}
              {(allocation.platinumDealer?.dealerName || allocation.dealerLocation?.locationName) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dealer</span>
                  <span className="text-sm text-muted-foreground">
                    {allocation.platinumDealer?.dealerName || allocation.dealerLocation?.locationName}
                  </span>
                </div>
              )}
            </div>

            {/* Remaining Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{remainingToAllocate}</strong> units remaining to allocate (excluding
                this allocation)
              </AlertDescription>
            </Alert>

            {/* Customer Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === '' ? undefined : parseInt(value, 10));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Current: {allocation.quantity} | Maximum: {maxQuantity} units
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="partially_fulfilled">Partially Fulfilled</SelectItem>
                      <SelectItem value="fulfilled">Fulfilled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Container Fields (for direct source only) */}
            {allocation.fulfillmentSource === 'direct' && (
              <>
                <FormField
                  control={form.control}
                  name="containerQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? undefined : parseInt(value, 10));
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Total units in the container
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., CONT-12345" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show remaining calculation and location selector */}
                {remainingContainerQty > 0 && (
                  <>
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium text-sm text-amber-900">
                            Remaining Container Units
                          </div>
                          <div className="text-sm">
                            Container has{' '}
                            <span className="font-bold text-amber-700">
                              {remainingContainerQty} units
                            </span>{' '}
                            remaining after customer allocation. These units will be stored at
                            the selected warehouse location.
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name={'locationId' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Warehouse Location (for remaining {remainingContainerQty} units) *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={loadingLocations}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select warehouse to receive remaining units" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Where should the remaining {remainingContainerQty} units be stored?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Warehouse Inventory Info */}
                    {inventoryInfo && watchedLocationId && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription>
                          {inventoryInfo.loading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading inventory...</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-medium text-sm text-blue-900">
                                Current Warehouse Inventory
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">On Hand:</span>
                                  <span className="ml-2 font-semibold">{inventoryInfo.onHand}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Allocated:</span>
                                  <span className="ml-2 font-semibold">{inventoryInfo.allocated}</span>
                                </div>
                                <div>
                                  <span className="text-green-700">Available:</span>
                                  <span className="ml-2 font-bold text-green-700">
                                    {inventoryInfo.available}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                After receiving {remainingContainerQty} units, on-hand will be{' '}
                                <span className="font-semibold">
                                  {inventoryInfo.onHand + remainingContainerQty}
                                </span>
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Allocation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
