'use client';

/**
 * GDC1 Inventory Table
 *
 * Full inventory listing from GDC1 warehouse.
 * Based on Jenny's "GDC 1" tab.
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
import type { GDC1InventoryItem, SKUColumnInfo } from '../types';

interface GDC1InventoryTableProps {
  data: GDC1InventoryItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns with product names
  onEdit?: (item: GDC1InventoryItem) => void;
}

export function GDC1InventoryTable({ data, uniqueSkus, onEdit }: GDC1InventoryTableProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
      'AVAILABLE': { variant: 'default', className: 'bg-green-500', label: 'Available' },
      'OPEN': { variant: 'outline', className: 'border-blue-500 text-blue-600', label: 'Open' },
      'SOLD': { variant: 'secondary', className: 'bg-orange-500 text-white', label: 'Sold' },
      'HOLD': { variant: 'outline', className: 'border-yellow-500 text-yellow-600', label: 'Hold' },
      'IN_TRANSIT': { variant: 'outline', className: 'border-purple-500 text-purple-600', label: 'In Transit' },
      'INVOICED': { variant: 'outline', className: 'border-green-500 text-green-600', label: 'Invoiced' },
      'NOT_INVOICED': { variant: 'outline', className: 'border-amber-500 text-amber-600', label: 'Not Invoiced' },
      'PARTIALLY_PAID': { variant: 'outline', className: 'border-cyan-500 text-cyan-600', label: 'Partially Paid' },
      'PAID': { variant: 'default', className: 'bg-teal-500', label: 'Paid' },
      'DISPUTED': { variant: 'destructive', label: 'Disputed' },
      'PO_NEEDED': { variant: 'outline', className: 'border-pink-500 text-pink-600', label: 'PO Needed' },
      'CLOSED': { variant: 'secondary', className: 'bg-gray-400 text-white', label: 'Closed' },
    };
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status.replace('_', ' ') };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) { return '-'; }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get quantity for a specific SKU from items array (sum all matching items)
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number => {
    return items?.filter((i) => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
  };

  // Get price for a specific SKU from items array (returns first matching price)
  const getSkuPrice = (items: { sku: string; unitPrice?: number }[], sku: string): number | null => {
    const item = items?.find((i) => i.sku === sku && i.unitPrice && i.unitPrice > 0);
    return item?.unitPrice || null;
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
        outstanding: acc.outstanding + item.outstandingPoQty,
        qtyDelivered: acc.qtyDelivered + item.qtyDelivered,
        invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
      };
    },
    { total: 0, outstanding: 0, qtyDelivered: 0, invoiceTotal: 0, skuTotals: {} as Record<string, number> }
  );

  // Group by status for summary
  const statusSummary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>GDC1 Warehouse Inventory</CardTitle>
        <CardDescription>
          {data.length} loads | Total: {totals.total} units |
          Available: {statusSummary['AVAILABLE'] || 0} |
          Sold: {statusSummary['SOLD'] || 0} |
          Invoice Total: {formatCurrency(totals.invoiceTotal)}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[2800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No.</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Load #</TableHead>
                {/* Dynamic SKU columns - shows full product name from database */}
                {uniqueSkus.map((skuInfo) => (
                  <TableHead key={skuInfo.sku} className="text-center text-xs whitespace-nowrap min-w-[100px]" title={skuInfo.sku}>
                    {skuInfo.productName} Qty
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">Total Qty</TableHead>
                <TableHead className="whitespace-nowrap min-w-[130px]">Customer</TableHead>
                <TableHead className="whitespace-nowrap min-w-[90px]">PO</TableHead>
                <TableHead className="whitespace-nowrap">ETA to US Port</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px]">Delivery Address</TableHead>
                <TableHead className="whitespace-nowrap">Confirmed ETA</TableHead>
                <TableHead className="whitespace-nowrap">Customer Expected</TableHead>
                <TableHead className="whitespace-nowrap">Actual Delivery</TableHead>
                <TableHead className="text-right whitespace-nowrap">Qty Delivered</TableHead>
                <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
                <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                <TableHead className="text-right whitespace-nowrap">Invoice Amt</TableHead>
                {/* Dynamic Price columns - one for each product from database */}
                {uniqueSkus.map((skuInfo) => (
                  <TableHead key={`price-${skuInfo.sku}`} className="text-right text-xs whitespace-nowrap min-w-[80px]" title={`${skuInfo.sku} Price`}>
                    {skuInfo.productName} Price
                  </TableHead>
                ))}
                <TableHead className="whitespace-nowrap">50% Payment</TableHead>
                <TableHead className="whitespace-nowrap">50% Due</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="min-w-[150px]">Action / Notes</TableHead>
                <TableHead className="min-w-[150px]">Ankur Comments</TableHead>
                <TableHead className="w-[50px]">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={item.id}
                  className={
                    item.status === 'AVAILABLE'
                      ? 'bg-green-50 dark:bg-green-950/20'
                      : item.status === 'SOLD'
                      ? 'bg-orange-50 dark:bg-orange-950/20'
                      : item.status === 'HOLD'
                      ? 'bg-yellow-50 dark:bg-yellow-950/20'
                      : ''
                  }
                >
                  <TableCell className="font-medium">{item.no}</TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{item.loadNumber}</TableCell>
                  {/* Dynamic SKU quantity columns - product names from database */}
                  {uniqueSkus.map((skuInfo) => {
                    const qty = getSkuQty(item.items, skuInfo.sku);
                    return (
                      <TableCell key={skuInfo.sku} className="text-center">
                        {qty > 0 ? qty : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>{item.customer || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{item.po || '-'}</TableCell>
                  <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={item.deliveryAddress || ''}>
                    {item.deliveryAddress || '-'}
                  </TableCell>
                  <TableCell>{formatDate(item.confirmedEta)}</TableCell>
                  <TableCell>{formatDate(item.customerExpectedDelivery)}</TableCell>
                  <TableCell>{formatDate(item.actualDelivery)}</TableCell>
                  <TableCell className="text-right">
                    {item.qtyDelivered > 0 ? item.qtyDelivered : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.outstandingPoQty > 0 ? (
                      <span className="text-orange-600 font-semibold">{item.outstandingPoQty}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.invoiceNumber || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.invoiceAmount)}</TableCell>
                  {/* Dynamic Price columns - one for each product */}
                  {uniqueSkus.map((skuInfo) => {
                    const price = getSkuPrice(item.items, skuInfo.sku);
                    return (
                      <TableCell key={`price-${skuInfo.sku}`} className="text-right">
                        {formatCurrency(price)}
                      </TableCell>
                    );
                  })}
                  <TableCell>{formatDate(item.payment50PercentDate)}</TableCell>
                  <TableCell>{formatDate(item.remaining50DueDate)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="max-w-[150px] text-xs text-muted-foreground truncate" title={item.actionRequired || ''}>
                    {item.actionRequired || '-'}
                  </TableCell>
                  <TableCell className="max-w-[150px] text-xs text-muted-foreground truncate" title={item.ankurNotes || ''}>
                    {item.ankurNotes || '-'}
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
                {/* Dynamic SKU quantity totals */}
                {uniqueSkus.map((skuInfo) => (
                  <TableCell key={skuInfo.sku} className="text-center">
                    {totals.skuTotals[skuInfo.sku] || 0}
                  </TableCell>
                ))}
                <TableCell className="text-right">{totals.total}</TableCell>
                {/* Empty cells: Customer, PO, ETA to US Port, Delivery Address, Confirmed ETA, Customer Expected, Actual Delivery */}
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{totals.qtyDelivered > 0 ? totals.qtyDelivered : '-'}</TableCell>
                <TableCell className="text-right text-orange-600">{totals.outstanding}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{formatCurrency(totals.invoiceTotal)}</TableCell>
                {/* Empty cells for dynamic price columns */}
                {uniqueSkus.map((skuInfo) => (
                  <TableCell key={`total-price-${skuInfo.sku}`}></TableCell>
                ))}
                {/* Empty cells: 50% Payment, 50% Due, Status, Action/Notes, Ankur Comments, Edit */}
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
