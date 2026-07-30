'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Pencil, Truck, MapPin, Package, Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useShipment } from '../hooks/useShipment';
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS } from '../types';
import type { ViewShipmentDrawerProps } from '../types';

export function ViewShipmentDrawer({
  open,
  onClose,
  shipmentId,
  onEdit,
}: ViewShipmentDrawerProps) {
  const { data: shipment, isLoading } = useShipment(open ? shipmentId : null);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : shipment ? (
                <>
                  <SheetTitle className="text-xl">{shipment.shipmentNumber}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(shipment.shipmentDate).toLocaleDateString()}
                  </p>
                </>
              ) : null}
            </div>
            {shipment && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  SHIPMENT_STATUS_COLORS[shipment.status]
                )}
              >
                {SHIPMENT_STATUS_LABELS[shipment.status]}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : shipment ? (
          <div className="mt-6 space-y-6">
            {/* Carrier Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Carrier Information
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{shipment.carrier || 'Not specified'}</p>
                  {shipment.trackingNumber && (
                    <p className="text-muted-foreground font-mono text-xs">
                      Tracking: {shipment.trackingNumber}
                    </p>
                  )}
                  {shipment.serviceType && (
                    <p className="text-muted-foreground text-xs">
                      Service: {shipment.serviceType}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Timeline
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Shipped</p>
                    <p className="font-medium">
                      {new Date(shipment.shipmentDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {shipment.estimatedArrival && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Est. Arrival</p>
                      <p className="font-medium">
                        {new Date(shipment.estimatedArrival).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {shipment.actualArrival && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Delivered</p>
                      <p className="font-medium text-emerald-600">
                        {new Date(shipment.actualArrival).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Ship To Address */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ship To
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {shipment.shipToName && (
                    <p className="font-medium">{shipment.shipToName}</p>
                  )}
                  {shipment.shipToAddressStreet && <p>{shipment.shipToAddressStreet}</p>}
                  <p>
                    {[
                      shipment.shipToAddressCity,
                      shipment.shipToAddressState,
                      shipment.shipToAddressPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {shipment.shipToAddressCountry && <p>{shipment.shipToAddressCountry}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({shipment.items.length})
              </h3>
              <div className="space-y-2">
                {shipment.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.sku}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          Qty: {item.quantityShipped}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipment Details */}
            {(shipment.totalWeight || shipment.totalPackages > 1) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Shipment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {shipment.totalWeight && (
                      <div>
                        <p className="text-muted-foreground">Weight</p>
                        <p className="font-medium">
                          {shipment.totalWeight} {shipment.weightUnit}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Packages</p>
                      <p className="font-medium">{shipment.totalPackages}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {(shipment.notes || shipment.deliveryInstructions) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {shipment.deliveryInstructions && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Delivery Instructions
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">
                        {shipment.deliveryInstructions}
                      </p>
                    </div>
                  )}
                  {shipment.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{shipment.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex gap-2">
              {onEdit && shipment.status === 'pending' && (
                <Button onClick={onEdit} className="flex-1">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Shipment
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Shipment not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
