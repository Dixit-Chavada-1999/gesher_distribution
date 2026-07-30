'use client';

/**
 * ViewSalesOrderDrawer Component
 *
 * Read-only drawer to view sales order details.
 * Fetches full order data with items when opened.
 */

import { useEffect, useState } from 'react';
import { Loader2, MapPin, Package, FileText, Calendar, User, Building2, Truck } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { getSalesOrder } from '../actions';
import type { SalesOrderWithItems } from '../types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../types';

// ============================================
// TYPES
// ============================================

interface ViewSalesOrderDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (order: SalesOrderWithItems) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value || value === '-') return null;
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function AddressDisplay({ label, address }: {
  label: string;
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }
}) {
  const hasAddress = address.street || address.city || address.state;
  if (!hasAddress) return null;

  const lines = [
    address.street,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm font-medium text-foreground">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewSalesOrderDrawer({
  orderId,
  open,
  onClose,
  onEdit,
}: ViewSalesOrderDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [order, setOrder] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!orderId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSalesOrder(orderId);
      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error || 'Failed to load order');
      }
    } catch (err) {
      setError('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleEdit = () => {
    if (order) {
      onEdit?.(order);
    }
  };

  // Can only edit draft or pending orders
  const canEdit = order && ['draft', 'pending'].includes(order.status);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[600px] md:max-w-[700px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : order?.orderNumber || 'Order Details'}
          </SheetTitle>
          <SheetDescription>
            {order?.customer?.name || 'View order information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchOrder} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : order ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>

                {/* Order Info */}
                <Section title="Order Information">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Order Number"
                      value={order.orderNumber}
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Order Date"
                      value={formatDate(order.orderDate)}
                      icon={<Calendar className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Requested Delivery"
                      value={formatDate(order.requestedDeliveryDate)}
                      icon={<Truck className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Customer PO"
                      value={order.customerPoNumber || '-'}
                      icon={<FileText className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Customer & Sales Rep */}
                <Section title="Customer & Sales">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InfoItem
                      label="Customer"
                      value={order.customer?.name}
                      icon={<Building2 className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Sales Representative"
                      value={order.salesRep ? `${order.salesRep.firstName} ${order.salesRep.lastName}` : null}
                      icon={<User className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Warehouse"
                      value={order.warehouse?.name}
                      icon={<Package className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Addresses */}
                <Section title="Addresses">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AddressDisplay
                      label="Billing Address"
                      address={{
                        street: order.billingAddressStreet,
                        city: order.billingAddressCity,
                        state: order.billingAddressState,
                        postalCode: order.billingAddressPostalCode,
                        country: order.billingAddressCountry,
                      }}
                    />
                    <AddressDisplay
                      label="Shipping Address"
                      address={{
                        street: order.shippingAddressStreet,
                        city: order.shippingAddressCity,
                        state: order.shippingAddressState,
                        postalCode: order.shippingAddressPostalCode,
                        country: order.shippingAddressCountry,
                      }}
                    />
                  </div>
                  {order.shippingMethod && (
                    <div className="mt-4">
                      <InfoItem label="Shipping Method" value={order.shippingMethod} icon={<Truck className="h-4 w-4" />} />
                    </div>
                  )}
                </Section>

                {/* Order Items */}
                <Section title="Order Items">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="text-right font-semibold">Qty</TableHead>
                          <TableHead className="text-right font-semibold">Unit Price</TableHead>
                          <TableHead className="text-right font-semibold">Disc %</TableHead>
                          <TableHead className="text-right font-semibold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{item.sku}</p>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right">{item.discountPercent}%</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(item.lineTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Section>

                {/* Order Totals */}
                <Section title="Order Summary">
                  <div className="space-y-3 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-destructive">-{formatCurrency(order.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{formatCurrency(order.taxTotal)}</span>
                    </div>
                    {order.shippingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="font-medium">{formatCurrency(order.shippingCost)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-base font-semibold">
                        <span>Grand Total</span>
                        <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Notes */}
                {(order.customerNotes || order.internalNotes) && (
                  <Section title="Notes">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {order.customerNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{order.customerNotes}</p>
                        </div>
                      )}
                      {order.internalNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internal Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{order.internalNotes}</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Cancellation Info */}
                {order.status === 'cancelled' && order.cancellationReason && (
                  <Section title="Cancellation" className="border-destructive/50">
                    <div className="bg-destructive/10 rounded-md p-3">
                      <p className="text-sm text-destructive font-medium">{order.cancellationReason}</p>
                      {order.cancelledAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Cancelled on {formatDate(order.cancelledAt)}
                        </p>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {order && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canEdit && onEdit && (
                <Button onClick={handleEdit}>
                  Edit Order
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
