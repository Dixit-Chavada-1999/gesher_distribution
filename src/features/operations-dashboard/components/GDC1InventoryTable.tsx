'use client';

/**
 * GDC1 Inventory Table
 *
 * Full inventory listing from GDC1 warehouse.
 * Based on Jenny's "GDC 1" tab.
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
import type { GDC1InventoryItem } from '../types';

interface GDC1InventoryTableProps {
  data: GDC1InventoryItem[];
  onEdit?: (item: GDC1InventoryItem) => void;
}

export function GDC1InventoryTable({ data, onEdit }: GDC1InventoryTableProps) {
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

  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      sku290: acc.sku290 + item.sku290_85R38Qty,
      sku380: acc.sku380 + item.sku380_85R24Qty,
      beadLock: acc.beadLock + item.skuBeadLockQty,
      total: acc.total + item.totalQty,
      outstanding: acc.outstanding + item.outstandingPoQty,
      invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
    }),
    { sku290: 0, sku380: 0, beadLock: 0, total: 0, outstanding: 0, invoiceTotal: 0 }
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
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">No.</TableHead>
                <TableHead>Load #</TableHead>
                <TableHead className="text-right">290/85R38</TableHead>
                <TableHead className="text-right">380/85R24</TableHead>
                <TableHead className="text-right">Bead Lock</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Ship Window</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>Customer Due</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Invoice Amt</TableHead>
                <TableHead className="text-right">38&quot; Price</TableHead>
                <TableHead className="text-right">24&quot; Price</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="font-mono text-sm">{item.loadNumber}</TableCell>
                  <TableCell className="text-right">
                    {item.sku290_85R38Qty > 0 ? item.sku290_85R38Qty : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.sku380_85R24Qty > 0 ? item.sku380_85R24Qty : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.skuBeadLockQty > 0 ? item.skuBeadLockQty : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>{item.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{item.po}</TableCell>
                  <TableCell className="text-xs">{item.customerShipWindow || '-'}</TableCell>
                  <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
                  <TableCell>{formatDate(item.customerDueDate)}</TableCell>
                  <TableCell className="text-right">
                    {item.outstandingPoQty > 0 ? (
                      <span className="text-orange-600 font-semibold">{item.outstandingPoQty}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.invoiceAmount)}</TableCell>
                  <TableCell className="text-right">
                    {item.price38 ? formatCurrency(item.price38) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.price24 ? formatCurrency(item.price24) : '-'}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
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
                <TableCell className="text-right">{totals.sku290}</TableCell>
                <TableCell className="text-right">{totals.sku380}</TableCell>
                <TableCell className="text-right">{totals.beadLock}</TableCell>
                <TableCell className="text-right">{totals.total}</TableCell>
                <TableCell colSpan={5}></TableCell>
                <TableCell className="text-right text-orange-600">{totals.outstanding}</TableCell>
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
