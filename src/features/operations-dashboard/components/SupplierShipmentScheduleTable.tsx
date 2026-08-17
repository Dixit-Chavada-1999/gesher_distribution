'use client';

/**
 * Supplier Shipment Schedule Table
 *
 * Full shipment schedule from suppliers.
 * Shows incoming inventory shipments with status tracking.
 * SKU items displayed dynamically based on shipment_items data.
 */

import { Pencil } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { ShipmentScheduleItem, SKUColumnInfo } from '../types';

interface SupplierShipmentScheduleTableProps {
  data: ShipmentScheduleItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns with product names
  title?: string;
  onEdit?: (item: ShipmentScheduleItem) => void;
}

export function SupplierShipmentScheduleTable({
  data,
  uniqueSkus,
  title = 'Incoming Inventory - Supplier Orders',
  onEdit,
}: SupplierShipmentScheduleTableProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
      'INVOICED': { variant: 'outline', className: 'border-green-500 text-green-600', label: 'Invoiced' },
      'IN_TRANSIT': { variant: 'default', className: 'bg-blue-500', label: 'In Transit' },
      'OPEN': { variant: 'secondary', label: 'Open' },
      'DELIVERED': { variant: 'outline', className: 'border-green-500 text-green-600', label: 'Delivered' },
    };
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get quantity for a specific SKU from items array (sum all matching items)
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number => {
    return items?.filter((i) => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
  };

  // Calculate totals including per-SKU totals
  const totals = data.reduce(
    (acc, item) => {
      // Calculate per-SKU totals
      uniqueSkus.forEach((skuInfo) => {
        acc.skuTotals[skuInfo.sku] = (acc.skuTotals[skuInfo.sku] || 0) + getSkuQty(item.items, skuInfo.sku);
      });
      return {
        ...acc,
        total: acc.total + item.totalQty,
        delivered: acc.delivered + item.qtyDelivered,
        outstanding: acc.outstanding + item.outstandingQtyForPO,
      };
    },
    { total: 0, delivered: 0, outstanding: 0, skuTotals: {} as Record<string, number> }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {data.length} shipments | Total: {totals.total} units | Outstanding: {totals.outstanding} units
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No.</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Load #</TableHead>
                {/* Dynamic SKU columns - shows full product name */}
                {uniqueSkus.map((skuInfo) => (
                  <TableHead key={skuInfo.sku} className="text-center text-xs whitespace-nowrap min-w-[150px]" title={skuInfo.sku}>
                    {skuInfo.productName}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px]">Customer</TableHead>
                <TableHead className="whitespace-nowrap min-w-[100px]">PO</TableHead>
                <TableHead className="whitespace-nowrap">ETA Port</TableHead>
                <TableHead className="whitespace-nowrap">Confirmed ETA</TableHead>
                <TableHead className="whitespace-nowrap">Customer Due</TableHead>
                <TableHead className="whitespace-nowrap">Delivered</TableHead>
                <TableHead className="text-right whitespace-nowrap">Qty Del.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px]">Delivery Address</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="min-w-[200px]">Action / Notes</TableHead>
                <TableHead className="w-[60px]">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={item.id}
                  className={
                    item.status === 'IN_TRANSIT'
                      ? 'bg-blue-50 dark:bg-blue-950/20'
                      : item.status === 'INVOICED'
                      ? 'bg-green-50 dark:bg-green-950/20'
                      : ''
                  }
                >
                  <TableCell className="font-medium">{item.no}</TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{item.loadNumber}</TableCell>
                  {/* Dynamic SKU quantity columns */}
                  {uniqueSkus.map((skuInfo) => {
                    const qty = getSkuQty(item.items, skuInfo.sku);
                    return (
                      <TableCell key={skuInfo.sku} className="text-center">
                        {qty > 0 ? qty : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>{item.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{item.po}</TableCell>
                  <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
                  <TableCell>{formatDate(item.confirmedEta)}</TableCell>
                  <TableCell>{formatDate(item.customerExpectedDelivery)}</TableCell>
                  <TableCell>{formatDate(item.actualDeliveryDate)}</TableCell>
                  <TableCell className="text-right">
                    {item.qtyDelivered > 0 ? item.qtyDelivered : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.outstandingQtyForPO > 0 ? (
                      <span className="text-orange-600 font-semibold">{item.outstandingQtyForPO}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={item.deliveryAddress || ''}>
                    {item.deliveryAddress || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground truncate" title={item.actionRequired}>
                    {item.actionRequired}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit?.(item)}
                      title="Edit Status"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell></TableCell>
                <TableCell>TOTAL</TableCell>
                {/* Dynamic SKU totals */}
                {uniqueSkus.map((skuInfo) => (
                  <TableCell key={skuInfo.sku} className="text-center">
                    {totals.skuTotals[skuInfo.sku] || 0}
                  </TableCell>
                ))}
                <TableCell className="text-right">{totals.total}</TableCell>
                <TableCell colSpan={6}></TableCell>
                <TableCell className="text-right">{totals.delivered}</TableCell>
                <TableCell className="text-right text-orange-600">{totals.outstanding}</TableCell>
                <TableCell colSpan={4}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
