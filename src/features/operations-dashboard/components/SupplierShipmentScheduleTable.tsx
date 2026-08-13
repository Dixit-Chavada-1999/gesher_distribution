'use client';

/**
 * Supplier Shipment Schedule Table
 *
 * Full shipment schedule from suppliers.
 * Shows incoming inventory shipments with status tracking.
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
import type { ShipmentScheduleItem } from '../types';

interface SupplierShipmentScheduleTableProps {
  data: ShipmentScheduleItem[];
  title?: string;
  onEdit?: (item: ShipmentScheduleItem) => void;
}

export function SupplierShipmentScheduleTable({
  data,
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

  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      sku290: acc.sku290 + item.sku290_85R38Qty,
      sku380: acc.sku380 + item.sku380_85R24Qty,
      total: acc.total + item.totalQty,
      delivered: acc.delivered + item.qtyDelivered,
      outstanding: acc.outstanding + item.outstandingQtyForPO,
    }),
    { sku290: 0, sku380: 0, total: 0, delivered: 0, outstanding: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {data.length} shipments | Total: {totals.total} units | Outstanding: {totals.outstanding} units
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
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>Customer Due</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead className="text-right">Qty Del.</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-w-[200px]">Action / Notes</TableHead>
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
                  <TableCell className="font-mono text-sm">{item.loadNumber}</TableCell>
                  <TableCell className="text-right">
                    {item.sku290_85R38Qty > 0 ? item.sku290_85R38Qty : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.sku380_85R24Qty > 0 ? item.sku380_85R24Qty : '-'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>{item.customer}</TableCell>
                  <TableCell className="font-mono text-xs">{item.po}</TableCell>
                  <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
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
                <TableCell className="text-right">{totals.sku290}</TableCell>
                <TableCell className="text-right">{totals.sku380}</TableCell>
                <TableCell className="text-right">{totals.total}</TableCell>
                <TableCell colSpan={5}></TableCell>
                <TableCell className="text-right">{totals.delivered}</TableCell>
                <TableCell className="text-right text-orange-600">{totals.outstanding}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
