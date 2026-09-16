'use client';

/**
 * ViewDealerDrawer Component
 *
 * View platinum dealer details with tabs for:
 * - Tab 1: Dealer Details
 * - Tab 2: Locations (manage dealer yards/warehouses)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Pencil,
  MapPinned,
  Plus,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
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

import {
  getDealerByIdAction,
  getLocationsByDealerIdAction,
  deleteDealerLocationAction,
  getAllInventoryForDealerAction,
} from '@/features/platinum-dealers/actions';
import type {
  PlatinumDealer,
  PlatinumDealerLocation,
} from '@/features/platinum-dealers/types';
import { AddDealerLocationDialog } from './add-location-dialog';
import { EditDealerLocationDialog } from './edit-location-dialog';
import { DealerLocationCard } from './dealer-location-card';
import { ViewLocationInventoryDrawer } from './view-location-inventory-drawer';

// ============================================
// TYPES
// ============================================

interface ViewDealerDrawerProps {
  dealerId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (dealer: PlatinumDealer) => void;
}

interface LocationInventorySummary {
  productCount: number;
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;
  products: Array<{
    sku: string;
    description: string;
    onHand: number;
    allocated: number;
    available: number;
  }>;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  if (!value || value === '-') {
    return null;
  }
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewDealerDrawer({
  dealerId,
  open,
  onClose,
  onEdit,
}: ViewDealerDrawerProps) {
  const [dealer, setDealer] = useState<PlatinumDealer | null>(null);
  const [locations, setLocations] = useState<PlatinumDealerLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [inventorySummaries, setInventorySummaries] = useState<
    Record<string, LocationInventorySummary>
  >({});

  // Dialog states
  const [addLocationDialogOpen, setAddLocationDialogOpen] = useState(false);
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [inventoryDrawerOpen, setInventoryDrawerOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<PlatinumDealerLocation | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<PlatinumDealerLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ----------------------------------------
  // DATA LOADING
  // ----------------------------------------

  const loadDealer = useCallback(async () => {
    if (!dealerId) {
      setDealer(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await getDealerByIdAction(dealerId);

      if (result.success && result.data) {
        setDealer(result.data);
      } else {
        toast.error(result.error || 'Failed to load dealer details');
        onClose();
      }
    } catch (error) {
      console.error('Error loading dealer:', error);
      toast.error('An unexpected error occurred');
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [dealerId, onClose]);

  const loadLocations = useCallback(async () => {
    if (!dealerId) {
      setLocations([]);
      return;
    }

    setIsLoadingLocations(true);
    try {
      const result = await getLocationsByDealerIdAction(dealerId);

      if (result.success && result.data) {
        setLocations(result.data);
      } else {
        toast.error(result.error || 'Failed to load locations');
      }
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setIsLoadingLocations(false);
    }
  }, [dealerId]);

  const loadInventorySummaries = useCallback(async () => {
    if (!dealerId) {
      setInventorySummaries({});
      return;
    }

    try {
      // Fetch all inventory for this dealer
      const result = await getAllInventoryForDealerAction(dealerId);

      if (result.success && result.data) {
        // Calculate summaries per location
        const summaries: Record<string, LocationInventorySummary> = {};

        result.data.forEach((item) => {
          const locationId = item.dealerLocationId;

          if (!summaries[locationId]) {
            summaries[locationId] = {
              productCount: 0,
              totalOnHand: 0,
              totalAllocated: 0,
              totalAvailable: 0,
              products: [],
            };
          }

          summaries[locationId].productCount += 1;
          summaries[locationId].totalOnHand += item.onHand;
          summaries[locationId].totalAllocated += item.allocated;
          summaries[locationId].totalAvailable += item.available;
          summaries[locationId].products.push({
            sku: item.product.sku,
            description: item.product.description || '',
            onHand: item.onHand,
            allocated: item.allocated,
            available: item.available,
          });
        });

        setInventorySummaries(summaries);
      }
    } catch (error) {
      console.error('Error loading inventory summaries:', error);
      // Don't show error toast for summaries - it's optional data
    }
  }, [dealerId]);

  useEffect(() => {
    if (open && dealerId) {
      loadDealer();
      loadLocations();
      loadInventorySummaries();
      setActiveTab('details'); // Reset to details tab
    } else {
      setDealer(null);
      setLocations([]);
      setInventorySummaries({});
      setActiveTab('details');
    }
  }, [dealerId, open, loadDealer, loadLocations, loadInventorySummaries]);

  // ----------------------------------------
  // HANDLERS - Dealer
  // ----------------------------------------

  const handleEdit = () => {
    if (dealer && onEdit) {
      onEdit(dealer);
    }
  };

  // ----------------------------------------
  // HANDLERS - Locations
  // ----------------------------------------

  const handleAddLocationClick = () => {
    setAddLocationDialogOpen(true);
  };

  const handleAddLocationSuccess = () => {
    loadLocations();
  };

  const handleEditLocation = (location: PlatinumDealerLocation) => {
    setSelectedLocationId(location.id);
    setEditLocationDialogOpen(true);
  };

  const handleEditLocationSuccess = () => {
    loadLocations();
  };

  const handleDeleteLocationClick = (location: PlatinumDealerLocation) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDealerLocationAction(locationToDelete.id);
      if (result.success) {
        toast.success(`Location "${locationToDelete.locationName}" deleted`);
        loadLocations();
      } else {
        toast.error(result.error || 'Failed to delete location');
      }
    } catch {
      toast.error('Failed to delete location');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setLocationToDelete(null);
  };

  const handleViewInventory = (location: PlatinumDealerLocation) => {
    setSelectedLocation(location);
    setInventoryDrawerOpen(true);
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  if (!open) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-[800px]"
        >
          {/* Header */}
          <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-xl font-semibold">
              {isLoading ? 'Loading...' : dealer?.dealerName || 'Dealer Details'}
            </SheetTitle>
            <SheetDescription>
              {dealer?.code || 'View dealer information and locations'}
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dealer ? (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1 flex flex-col"
            >
              <div className="border-b px-6">
                <TabsList className="h-10">
                  <TabsTrigger value="details" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Dealer Details
                  </TabsTrigger>
                  <TabsTrigger value="locations" className="gap-2">
                    <MapPinned className="h-4 w-4" />
                    Locations
                    {locations.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                        {locations.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab 1: Dealer Details */}
              <TabsContent value="details" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-6">
                    <div className="space-y-6 pb-6">
                      {/* Header Section */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h3 className="text-xl font-semibold">{dealer.dealerName}</h3>
                          {dealer.code && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {dealer.code}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={
                            dealer.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }
                        >
                          {dealer.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <Separator />

                      {/* Contact Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">
                            Contact Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <InfoItem
                            label="Contact Name"
                            value={dealer.contactName}
                            icon={<User className="h-4 w-4" />}
                          />
                          <InfoItem
                            label="Email"
                            value={dealer.email}
                            icon={<Mail className="h-4 w-4" />}
                          />
                          <InfoItem
                            label="Phone"
                            value={dealer.phone}
                            icon={<Phone className="h-4 w-4" />}
                          />
                        </CardContent>
                      </Card>

                      {/* Address */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <InfoItem
                            label="Location"
                            value={
                              <div className="space-y-1">
                                {dealer.addressStreet && <p>{dealer.addressStreet}</p>}
                                <p>
                                  {[dealer.addressCity, dealer.addressState]
                                    .filter(Boolean)
                                    .join(', ')}
                                  {dealer.addressPostalCode &&
                                    ` ${dealer.addressPostalCode}`}
                                </p>
                                {dealer.addressCountry && <p>{dealer.addressCountry}</p>}
                              </div>
                            }
                            icon={<MapPin className="h-4 w-4" />}
                          />
                        </CardContent>
                      </Card>

                      {/* Notes */}
                      {dealer.notes && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm font-medium">Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {dealer.notes}
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-4">
                        {onEdit && dealer.status === 'active' && (
                          <Button onClick={handleEdit} className="flex-1">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Dealer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 2: Locations */}
              <TabsContent value="locations" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-6">
                    <div className="space-y-4">
                      {/* Header with Add Button */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold">Dealer Locations</h3>
                          <p className="text-sm text-muted-foreground">
                            Manage yards and warehouses for this dealer
                          </p>
                        </div>
                        <Button onClick={handleAddLocationClick}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Location
                        </Button>
                      </div>

                      <Separator />

                      {/* Locations List */}
                      {isLoadingLocations ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : locations.length > 0 ? (
                        <div className="space-y-3">
                          {locations.map((location) => (
                            <DealerLocationCard
                              key={location.id}
                              location={location}
                              inventorySummary={inventorySummaries[location.id] || null}
                              onEdit={handleEditLocation}
                              onDelete={handleDeleteLocationClick}
                              onViewInventory={handleViewInventory}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <MapPinned className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No locations yet</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Add the first location for this dealer to start tracking inventory.
                          </p>
                          <Button onClick={handleAddLocationClick}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Location
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-muted-foreground">No dealer data available</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Location Dialog */}
      {dealerId && (
        <AddDealerLocationDialog
          open={addLocationDialogOpen}
          dealerId={dealerId}
          onClose={() => setAddLocationDialogOpen(false)}
          onSuccess={handleAddLocationSuccess}
        />
      )}

      {/* Edit Location Dialog */}
      <EditDealerLocationDialog
        open={editLocationDialogOpen}
        locationId={selectedLocationId}
        onClose={() => {
          setEditLocationDialogOpen(false);
          setSelectedLocationId(null);
        }}
        onSuccess={handleEditLocationSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete location{' '}
              <span className="font-semibold">{locationToDelete?.locationName}</span>?
              This action cannot be undone.
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

      {/* View Location Inventory Drawer */}
      <ViewLocationInventoryDrawer
        open={inventoryDrawerOpen}
        location={selectedLocation}
        onClose={() => {
          setInventoryDrawerOpen(false);
          setSelectedLocation(null);
          loadInventorySummaries(); // Refresh summaries when inventory drawer closes
        }}
      />
    </>
  );
}
