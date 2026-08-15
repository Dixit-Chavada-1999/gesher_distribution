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
      'SOLD': { variant: 'secondary', className: 'bg-orange-500 text-white', label: 'Sold' },
      'HOLD': { variant: 'outline', className: 'border-yellow-500 text-yellow-600', label: 'Hold' },
      'INVOICED': { variant: 'outline', className: 'border-green-500 text-green-600', label: 'Invoiced' },
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

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) { return '-'; }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get quantity for a specific SKU from items array
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number => {
    const item = items?.find((i) => i.sku === sku);
    return item?.qty || 0;
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
        invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
      };
    },
    { total: 0, outstanding: 0, invoiceTotal: 0, skuTotals: {} as Record<string, number> }
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
          <Table className="min-w-[2200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No.</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Load #</TableHead>
                {/* Dynamic SKU columns - shows full product name */}
                {uniqueSkus.map((skuInfo) => (
                  <TableHead key={skuInfo.sku} className="text-right text-xs whitespace-nowrap min-w-[150px]" title={skuInfo.sku}>
                    {skuInfo.productName}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px]">Customer</TableHead>
                <TableHead className="whitespace-nowrap min-w-[100px]">PO</TableHead>
                <TableHead className="whitespace-nowrap">Ship Window</TableHead>
                <TableHead className="whitespace-nowrap">ETA Port</TableHead>
                <TableHead className="whitespace-nowrap">Customer Due</TableHead>
                <TableHead className="whitespace-nowrap">Actual Delivery</TableHead>
                <TableHead className="text-right whitespace-nowrap">Qty Del.</TableHead>
                <TableHead className="text-right whitespace-nowrap">Outstanding</TableHead>
                <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                <TableHead className="text-right whitespace-nowrap">Invoice Amt</TableHead>
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
                    item.status === 'AVAILABLE'
                      ? 'bg-green-50 dark:bg-green-950/20'
                      : item.status === 'SOLD'
                      ? 'bg-orange-50 dark:bg-orange-950/20'
                      : ''
                  }
                >
                  <TableCell className="font-medium">{item.no}</TableCell>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{item.loadNumber}</TableCell>
                  {/* Dynamic SKU quantity columns */}
                  {uniqueSkus.map((skuInfo) => {
                    const qty = getSkuQty(item.items, skuInfo.sku);
                    return (
                      <TableCell key={skuInfo.sku} className="text-right">
                        {qty > 0 ? qty : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>{item.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{item.po}</TableCell>
                  <TableCell className="text-xs">{item.customerShipWindow || '-'}</TableCell>
                  <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
                  <TableCell>{formatDate(item.customerDueDate)}</TableCell>
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
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={item.deliveryAddress || ''}>
                    {item.deliveryAddress || '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground truncate" title={`${item.actionRequired || ''} ${item.ankurNotes || ''}`}>
                    {item.actionRequired || item.ankurNotes || '-'}
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
                  <TableCell key={skuInfo.sku} className="text-right">
                    {totals.skuTotals[skuInfo.sku] || 0}
                  </TableCell>
                ))}
                <TableCell className="text-right">{totals.total}</TableCell>
                <TableCell colSpan={7}></TableCell>
                <TableCell className="text-right text-orange-600">{totals.outstanding}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{formatCurrency(totals.invoiceTotal)}</TableCell>
                <TableCell colSpan={4}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
