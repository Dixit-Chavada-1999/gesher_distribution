/**
 * CreateAllocationDialog Component
 *
 * Dialog for creating a new fulfillment allocation.
 * Supports conditional fields based on fulfillment source.
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
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createFulfillmentAllocationSchema,
  type CreateFulfillmentAllocationInput,
} from '@/features/sales-orders/validations/fulfillment-allocation.schema';
import { createAllocationAction } from '@/features/sales-orders/actions/fulfillment-allocation.actions';
import type { FulfillmentSource } from '@/features/sales-orders/types';

// ============================================
// TYPES
// ============================================

interface CreateAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderItemId: string;
  productId: string;
  remainingToAllocate: number;
  onSuccess: () => void;
}

interface Location {
  id: string;
  name: string;
}

interface Dealer {
  id: string;
  dealerName: string;
}

interface DealerLocation {
  id: string;
  locationName: string;
}

// ============================================
// COMPONENT
// ============================================

export function CreateAllocationDialog({
  open,
  onOpenChange,
  salesOrderItemId,
  productId,
  remainingToAllocate,
  onSuccess,
}: CreateAllocationDialogProps) {

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSource, setSelectedSource] = useState<FulfillmentSource | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [dealerLocations, setDealerLocations] = useState<DealerLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [inventoryInfo, setInventoryInfo] = useState<{
    onHand: number;
    allocated: number;
    available: number;
    loading: boolean;
  } | null>(null);

  // Cache for all location inventory (prefetched)
  const [locationInventoryCache, setLocationInventoryCache] = useState<Record<string, {
    onHand: number;
    allocated: number;
    available: number;
  }>>({});
  const [dealerInventoryCache, setDealerInventoryCache] = useState<Record<string, {
    onHand: number;
    allocated: number;
    available: number;
  }>>({});

  // Form
  const form = useForm<CreateFulfillmentAllocationInput>({
    resolver: zodResolver(createFulfillmentAllocationSchema),
    defaultValues: {
      salesOrderItemId,
      fulfillmentSource: 'direct',
      quantity: remainingToAllocate,
      notes: '',
      // Add default values for conditional fields to prevent controlled/uncontrolled warning
      containerQty: remainingToAllocate,
      containerId: '',
      locationId: '',
      platinumDealerId: '',
      dealerLocationId: '',
    } as any,
  });

  const watchedSource = form.watch('fulfillmentSource');
  const watchedDealerId = form.watch('platinumDealerId' as any);
  const watchedLocationId = form.watch('locationId' as any);
  const watchedDealerLocationId = form.watch('dealerLocationId' as any);
  const watchedQuantity = form.watch('quantity');
  const watchedContainerQty = form.watch('containerQty' as any);

  // Calculate remaining units for manufacturer (direct)
  const remainingContainerQty =
    watchedSource === 'direct' && watchedContainerQty && watchedQuantity
      ? watchedContainerQty - watchedQuantity
      : 0;

  // ============================================
  // DATA FETCHING
  // ============================================

  async function loadLocations() {
    try {
      setLoadingLocations(true);
      // Import and call locations action
      const { getAllLocationsAction } = await import('@/features/locations/actions');
      const result = await getAllLocationsAction({ type: 'warehouse' });

      if (result.success && result.data) {
        const locs = result.data.map((loc) => ({
          id: loc.id,
          name: `${loc.locationCode} - ${loc.name}`,
        }));
        setLocations(locs);

        // Prefetch inventory for all locations (async, don't await)
        if (locs.length > 0) {
          prefetchGdcInventory(locs);
        }
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadDealers() {
    try {
      setLoadingDealers(true);
      // Import and call dealers action
      const { getAllDealersAction } = await import(
        '@/features/platinum-dealers/actions'
      );
      const result = await getAllDealersAction({ status: 'active' });

      if (result.success && result.data) {
        setDealers(
          result.data.map((dealer) => ({
            id: dealer.id,
            dealerName: dealer.dealerName,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dealers:', error);
    } finally {
      setLoadingDealers(false);
    }
  }

  // Prefetch all GDC inventory for this product when locations load
  async function prefetchGdcInventory(locs: Location[]) {
    try {
      if (locs.length === 0) return;

      const { getInventoryByProductAndLocation } = await import('@/features/inventory/actions');
      const cache: Record<string, { onHand: number; allocated: number; available: number }> = {};

      // Fetch inventory for all locations in parallel
      await Promise.all(
        locs.map(async (loc) => {
          const result = await getInventoryByProductAndLocation(productId, loc.id);
          if (result.success && result.data) {
            cache[loc.id] = {
              onHand: result.data.onHand,
              allocated: result.data.allocated,
              available: result.data.onHand - result.data.allocated,
            };
          } else {
            cache[loc.id] = { onHand: 0, allocated: 0, available: 0 };
          }
        })
      );

      setLocationInventoryCache(cache);
    } catch (error) {
      console.error('Error prefetching GDC inventory:', error);
    }
  }

  async function loadGdcInventory(locationId: string) {
    // Check cache first
    if (locationInventoryCache[locationId]) {
      setInventoryInfo({
        ...locationInventoryCache[locationId],
        loading: false,
      });
      return;
    }

    // Fallback to API call if not in cache
    try {
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: true });

      const { getInventoryByProductAndLocation } = await import('@/features/inventory/actions');
      const result = await getInventoryByProductAndLocation(productId, locationId);

      if (result.success && result.data) {
        const invData = {
          onHand: result.data.onHand,
          allocated: result.data.allocated,
          available: result.data.onHand - result.data.allocated,
        };
        setInventoryInfo({ ...invData, loading: false });
        // Update cache
        setLocationInventoryCache(prev => ({ ...prev, [locationId]: invData }));
      } else {
        setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
      }
    } catch (error) {
      console.error('Error loading GDC inventory:', error);
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
    }
  }

  // Prefetch dealer inventory for all dealer locations
  async function prefetchDealerInventory(dealerLocs: DealerLocation[]) {
    try {
      if (dealerLocs.length === 0) return;

      const { getDealerInventoryAction } = await import('@/features/platinum-dealers/actions');
      const cache: Record<string, { onHand: number; allocated: number; available: number }> = {};

      // Fetch inventory for all dealer locations in parallel
      await Promise.all(
        dealerLocs.map(async (loc) => {
          const result = await getDealerInventoryAction({
            dealerLocationId: loc.id,
            productId,
          });
          if (result.success && result.data) {
            cache[loc.id] = {
              onHand: result.data.onHand,
              allocated: result.data.allocated,
              available: result.data.available,
            };
          } else {
            cache[loc.id] = { onHand: 0, allocated: 0, available: 0 };
          }
        })
      );

      setDealerInventoryCache(cache);
    } catch (error) {
      console.error('Error prefetching dealer inventory:', error);
    }
  }

  async function loadDealerInventory(dealerLocationId: string) {
    // Check cache first
    if (dealerInventoryCache[dealerLocationId]) {
      setInventoryInfo({
        ...dealerInventoryCache[dealerLocationId],
        loading: false,
      });
      return;
    }

    // Fallback to API call if not in cache
    try {
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: true });

      const { getDealerInventoryAction } = await import('@/features/platinum-dealers/actions');
      const result = await getDealerInventoryAction({
        dealerLocationId,
        productId,
      });

      if (result.success && result.data) {
        const invData = {
          onHand: result.data.onHand,
          allocated: result.data.allocated,
          available: result.data.available,
        };
        setInventoryInfo({ ...invData, loading: false });
        // Update cache
        setDealerInventoryCache(prev => ({ ...prev, [dealerLocationId]: invData }));
      } else {
        setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
      }
    } catch (error) {
      console.error('Error loading dealer inventory:', error);
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
    }
  }

  async function loadDealerLocations(dealerId: string) {
    try {
      // Import and call dealer locations action
      const { getLocationsByDealerIdAction } = await import(
        '@/features/platinum-dealers/actions'
      );
      const result = await getLocationsByDealerIdAction(dealerId);

      if (result.success && result.data) {
        const dealerLocs = result.data.map((loc) => ({
          id: loc.id,
          locationName: loc.locationName,
        }));
        setDealerLocations(dealerLocs);

        // Prefetch dealer inventory (async, don't await)
        if (dealerLocs.length > 0) {
          prefetchDealerInventory(dealerLocs);
        }
      }
    } catch (error) {
      console.error('Error loading dealer locations:', error);
    }
  }

  // Load locations when GDC inventory selected OR when manufacturer (direct) has remaining qty
  useEffect(() => {
    if (watchedSource === 'gdc_inventory' && locations.length === 0) {
      loadLocations();
    }
    // Load locations for manufacturer (direct) when there are remaining units
    if (watchedSource === 'direct' && remainingContainerQty > 0 && locations.length === 0) {
      loadLocations();
    }
  }, [watchedSource, remainingContainerQty]);

  // Load dealers when dealer source selected
  useEffect(() => {
    if (
      (watchedSource === 'platinum_dealer_inventory' ||
        watchedSource === 'platinum_dealer_fulfillment') &&
      dealers.length === 0
    ) {
      loadDealers();
    }
  }, [watchedSource]);

  // Load dealer locations when dealer selected
  useEffect(() => {
    if (watchedDealerId) {
      loadDealerLocations(watchedDealerId);
    }
  }, [watchedDealerId]);

  // Update selected source state
  useEffect(() => {
    setSelectedSource(watchedSource);
  }, [watchedSource]);

  // Load GDC inventory when location selected
  useEffect(() => {
    if (watchedSource === 'gdc_inventory' && watchedLocationId) {
      loadGdcInventory(watchedLocationId);
    } else if (watchedSource !== 'gdc_inventory') {
      setInventoryInfo(null);
    }
  }, [watchedLocationId, watchedSource, productId]);

  // Load dealer inventory when dealer location selected
  useEffect(() => {
    if (watchedSource === 'platinum_dealer_inventory' && watchedDealerLocationId) {
      loadDealerInventory(watchedDealerLocationId);
    } else if (watchedSource !== 'platinum_dealer_inventory') {
      // Don't clear if switching from dealer inventory to dealer fulfillment
      if (watchedSource !== 'platinum_dealer_fulfillment') {
        setInventoryInfo(null);
      }
    }
  }, [watchedDealerLocationId, watchedSource, productId]);

  // Load inventory for manufacturer (direct) when location selected for remaining units
  useEffect(() => {
    if (watchedSource === 'direct' && remainingContainerQty > 0 && watchedLocationId) {
      loadGdcInventory(watchedLocationId);
    } else if (watchedSource === 'direct' && remainingContainerQty === 0) {
      setInventoryInfo(null);
    }
  }, [watchedLocationId, watchedSource, remainingContainerQty, productId]);

  // ============================================
  // HANDLERS
  // ============================================

  async function onSubmit(data: CreateFulfillmentAllocationInput) {
    try {
      setIsSubmitting(true);

      const result = await createAllocationAction(data, productId);

      if (result.success) {
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to create allocation');
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
          <DialogTitle>Create Allocation</DialogTitle>
          <DialogDescription>
            Allocate fulfillment for this sales order item from a specific source.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Remaining Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{remainingToAllocate}</strong> units remaining to allocate
              </AlertDescription>
            </Alert>

            {/* Fulfillment Source */}
            <FormField
              control={form.control}
              name="fulfillmentSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fulfillment Source *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">Manufacturer (Direct)</SelectItem>
                      <SelectItem value="gdc_inventory">GDC Inventory</SelectItem>
                      <SelectItem value="platinum_dealer_inventory">
                        Platinum Dealer Inventory
                      </SelectItem>
                      <SelectItem value="platinum_dealer_fulfillment">
                        Platinum Dealer Fulfillment
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Quantity - Show for all sources except direct (direct has custom order) */}
            {selectedSource !== 'direct' && (
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum: {remainingToAllocate} units
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* GDC Inventory - Location */}
            {selectedSource === 'gdc_inventory' && (
              <>
                <FormField
                  control={form.control}
                  name={'locationId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loadingLocations}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Inventory Info */}
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
                          <div className="font-medium text-sm text-blue-900">Location Inventory</div>
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
                              <span className="ml-2 font-bold text-green-700">{inventoryInfo.available}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Direct - Container Qty First, then Customer Allocated Qty */}
            {selectedSource === 'direct' && (
              <>
                {/* Step 1: Container Quantity */}
                <FormField
                  control={form.control}
                  name={'containerQty' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormDescription>
                        Total units in the container (e.g., 72 for a full container)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Step 2: Customer Quantity */}
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Quantity *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormDescription>
                        Units allocated to customer (Maximum: {remainingToAllocate} units)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={'containerId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container ID (Optional)</FormLabel>
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
                            defaultValue={field.value}
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

            {/* Platinum Dealer - Dealer + Location */}
            {(selectedSource === 'platinum_dealer_inventory' ||
              selectedSource === 'platinum_dealer_fulfillment') && (
              <>
                <FormField
                  control={form.control}
                  name={'platinumDealerId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platinum Dealer *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loadingDealers}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select dealer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealers.map((dealer) => (
                            <SelectItem key={dealer.id} value={dealer.id}>
                              {dealer.dealerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedSource === 'platinum_dealer_inventory' && watchedDealerId && (
                  <>
                    <FormField
                      control={form.control}
                      name={'dealerLocationId' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dealer Location *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {dealerLocations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.locationName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Dealer Inventory Info */}
                    {inventoryInfo && watchedDealerLocationId && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription>
                          {inventoryInfo.loading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading inventory...</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-medium text-sm text-blue-900">Dealer Inventory</div>
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
                                  <span className="ml-2 font-bold text-green-700">{inventoryInfo.available}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {selectedSource === 'platinum_dealer_fulfillment' && watchedDealerId && dealerLocations.length > 0 && (
                  <FormField
                    control={form.control}
                    name={'dealerLocationId' as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dealer Location (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select location (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {dealerLocations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.locationName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
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
                Create Allocation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
