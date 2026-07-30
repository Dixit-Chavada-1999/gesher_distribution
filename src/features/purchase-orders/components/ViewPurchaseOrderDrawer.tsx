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
import { Pencil, Building2, MapPin, Package, User } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { PO_STATUS_COLORS, PO_STATUS_LABELS } from '../types';
import type { ViewPurchaseOrderDrawerProps } from '../types';

export function ViewPurchaseOrderDrawer({
  open,
  onClose,
  poId,
  onEdit,
}: ViewPurchaseOrderDrawerProps) {
  const { data: po, isLoading } = usePurchaseOrder(open ? poId : null);

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
              ) : po ? (
                <>
                  <SheetTitle className="text-xl">{po.poNumber}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(po.poDate).toLocaleDateString()}
                  </p>
                </>
              ) : null}
            </div>
            {po && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  PO_STATUS_COLORS[po.status]
                )}
              >
                {PO_STATUS_LABELS[po.status]}
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
        ) : po ? (
          <div className="mt-6 space-y-6">
            {/* Supplier Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Supplier
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{po.supplierName}</p>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{po.supplierContact}</span>
                  </div>
                </div>
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
                  {po.shipToAddressStreet && <p>{po.shipToAddressStreet}</p>}
                  <p>
                    {[
                      po.shipToAddressCity,
                      po.shipToAddressState,
                      po.shipToAddressPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {po.shipToAddressCountry && <p>{po.shipToAddressCountry}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({po.items.length})
              </h3>
              <div className="space-y-2">
                {po.items.map((item) => (
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
                          ${(item.lineTotal / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.quantityOrdered} x ${(item.unitPrice / 100).toFixed(2)}
                        {item.quantityReceived > 0 && (
                          <span className="ml-2 text-emerald-600">
                            ({item.quantityReceived} received)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(po.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>${(po.taxTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>${(po.shippingCost / 100).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Grand Total</span>
                <span>${(po.grandTotal / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {(po.vendorNotes || po.internalNotes) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {po.vendorNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Vendor Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{po.vendorNotes}</p>
                    </div>
                  )}
                  {po.internalNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Internal Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{po.internalNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex gap-2">
              {onEdit && po.status === 'draft' && (
                <Button onClick={onEdit} className="flex-1">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit PO
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Purchase order not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
