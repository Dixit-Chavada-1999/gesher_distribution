'use client';

/**
 * Shipment Overview Table
 *
 * Shows summary of shipments by customer with in-transit status.
 * Based on Jenny's "Shipment Overview" tab.
 */

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
import type { ImmediateAttentionItem, CustomerCommitment } from '../types';

interface ShipmentOverviewTableProps {
  inTransitItems: ImmediateAttentionItem[];
  customerSummary: CustomerCommitment[];
}

export function ShipmentOverviewTable({
  inTransitItems,
  customerSummary,
}: ShipmentOverviewTableProps) {
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      'IN_TRANSIT': { variant: 'default', label: 'In Transit' },
      'OPEN': { variant: 'secondary', label: 'Open' },
      'INVOICED': { variant: 'outline', label: 'Invoiced' },
      'DELIVERED': { variant: 'outline', label: 'Delivered' },
    };
    const config = statusConfig[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Customer Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Summary</CardTitle>
          <CardDescription>Outstanding orders by customer</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Outstanding Qty</TableHead>
                <TableHead className="text-right">Invoice Amount</TableHead>
                <TableHead className="text-right">In Transit / Next 7 Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerSummary.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.customer}</TableCell>
                  <TableCell className="text-right">{customer.loads}</TableCell>
                  <TableCell className="text-right">{customer.outstandingQty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(customer.invoiceAmount)}</TableCell>
                  <TableCell className="text-right">
                    {customer.inTransitNext7Days > 0 ? (
                      <Badge variant="destructive">{customer.inTransitNext7Days}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  {customerSummary.reduce((sum, c) => sum + c.loads, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {customerSummary.reduce((sum, c) => sum + c.outstandingQty, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(customerSummary.reduce((sum, c) => sum + c.invoiceAmount, 0))}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">
                    {customerSummary.reduce((sum, c) => sum + c.inTransitNext7Days, 0)}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* In Transit / Immediate Attention */}
      <Card>
        <CardHeader>
          <CardTitle>In Transit / Next 7 Days</CardTitle>
          <CardDescription>Shipments requiring immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Load #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>ETA to Port</TableHead>
                <TableHead>Customer Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inTransitItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={item.isOverdue ? 'bg-red-50 dark:bg-red-950/20' : ''}
                >
                  <TableCell className="font-medium">{item.loadNumber}</TableCell>
                  <TableCell>{item.customer}</TableCell>
                  <TableCell>{item.po}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell>{formatDate(item.etaPort)}</TableCell>
                  <TableCell>
                    <span className={item.isOverdue ? 'text-red-600 font-semibold' : ''}>
                      {formatDate(item.customerEtaDue)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={item.actionRequired}>
                    {item.actionRequired}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
