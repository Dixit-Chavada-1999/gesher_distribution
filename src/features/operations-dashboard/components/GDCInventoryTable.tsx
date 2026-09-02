'use client';

/**
 * GDC Inventory Table (Dynamic by Order Series)
 *
 * Shows Purchase Orders filtered by order_series (GDC 1, GDC 2, GDC 3).
 * Based on the redesign from Aug 24 call - GDC is "order series" not warehouse location.
 */

import { useState } from 'react';
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
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { GDCInventoryItem, SKUColumnInfo } from '../types';

interface GDCInventoryTableProps {
  orderSeries: string;          // e.g., "GDC 1"
  data: GDCInventoryItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns with product names
  onEdit?: (item: GDCInventoryItem) => void;
}

// PO Status colors
const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function GDCInventoryTable({ orderSeries, data, uniqueSkus, onEdit }: GDCInventoryTableProps) {
  // State for expanded addresses and notes
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressId(expandedAddressId === id ? null : id);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotesId(expandedNotesId === id ? null : id);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get quantity for a specific SKU from items array
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
      };
    },
    { total: 0, skuTotals: {} as Record<string, number> }
  );

  // Count by status
  const statusSummary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{orderSeries} Inventory</CardTitle>
        <CardDescription>
          {data.length} POs | Total: {totals.total} units |
          Confirmed: {statusSummary['confirmed'] || 0} |
          Sent: {statusSummary['sent'] || 0} |
          Draft: {statusSummary['draft'] || 0}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No Purchase Orders with {orderSeries} order series
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No.</TableHead>
                  <TableHead className="min-w-[120px] whitespace-nowrap">PO #</TableHead>
                  <TableHead className="min-w-[100px] whitespace-nowrap">SO #</TableHead>
                  {/* Dynamic SKU columns */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableHead key={skuInfo.sku} className="text-center text-xs whitespace-nowrap min-w-[80px]" title={skuInfo.sku}>
                      {skuInfo.productName} Qty
                    </TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">Total Qty</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Customer</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Supplier</TableHead>
                  <TableHead className="whitespace-nowrap">Expected Delivery</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">Delivery Address</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[150px]">Notes</TableHead>
                  <TableHead className="w-[50px]">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.status === 'confirmed'
                        ? 'bg-green-50 dark:bg-green-950/20'
                        : item.status === 'sent'
                        ? 'bg-blue-50 dark:bg-blue-950/20'
                        : item.status === 'draft'
                        ? 'bg-gray-50 dark:bg-gray-950/20'
                        : ''
                    }
                  >
                    <TableCell className="font-medium">{item.no}</TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{item.poNumber}</TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">{item.soNumber || '-'}</TableCell>
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
                    <TableCell>{item.customer || 'Unallocated'}</TableCell>
                    <TableCell>{item.supplierName || '-'}</TableCell>
                    <TableCell>{formatDate(item.expectedDelivery)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {item.deliveryAddress ? (
                        expandedAddressId === item.id ? (
                          <div className="text-xs text-muted-foreground">
                            <span>{item.deliveryAddress}</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="truncate">{item.deliveryAddress.substring(0, 20)}</span>
                            <button
                              className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                              onClick={() => toggleAddressExpand(item.id)}
                            >
                              ...
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={PO_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {item.actionRequired ? (
                        expandedNotesId === item.id ? (
                          <div className="text-xs text-muted-foreground">
                            <span>{item.actionRequired}</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="truncate">{item.actionRequired.substring(0, 20)}</span>
                            {item.actionRequired.length > 20 && (
                              <button
                                className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                                onClick={() => toggleNotesExpand(item.id)}
                              >
                                ...
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit?.(item)}
                        title="Edit"
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
                  <TableCell></TableCell>
                  {/* Dynamic SKU quantity totals */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableCell key={skuInfo.sku} className="text-center">
                      {totals.skuTotals[skuInfo.sku] || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{totals.total}</TableCell>
                  {/* Empty cells for remaining columns */}
                  <TableCell></TableCell>
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
        )}
      </CardContent>
    </Card>
  );
}
