'use client';

/**
 * Immediate Attention Table Component
 *
 * Shows shipments that need immediate attention:
 * - In Transit items
 * - Items delivering in next 7 days
 * - Overdue items highlighted in red
 */

import { AlertTriangle, Truck, Pencil } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { ImmediateAttentionItem, ShipmentStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface ImmediateAttentionTableProps {
  items: ImmediateAttentionItem[];
  onViewDetails?: (item: ImmediateAttentionItem) => void;
  onAddNote?: (item: ImmediateAttentionItem) => void;
  onEdit?: (item: ImmediateAttentionItem) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(status: ShipmentStatus, isOverdue: boolean) {
  if (isOverdue) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        DELAYED
      </Badge>
    );
  }

  const statusStyles: Record<ShipmentStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
    AVAILABLE: { variant: 'outline', className: 'bg-gray-50 text-gray-700 border-gray-200' },
    SOLD: { variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    OPEN: { variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    HOLD: { variant: 'outline', className: 'bg-red-50 text-red-700 border-red-200' },
    IN_TRANSIT: { variant: 'outline', className: 'bg-purple-50 text-purple-700 border-purple-200' },
    INVOICED: { variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    DELIVERED: { variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
  };

  const style = statusStyles[status] || statusStyles.OPEN;

  return (
    <Badge variant={style.variant} className={style.className}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ImmediateAttentionTable({
  items,
  onViewDetails: _onViewDetails,
  onAddNote: _onAddNote,
  onEdit,
}: ImmediateAttentionTableProps) {
  // Sort by overdue first, then by this week, then by date
  const sortedItems = [...items].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) {
      return -1;
    }
    if (!a.isOverdue && b.isOverdue) {
      return 1;
    }
    if (a.isThisWeek && !b.isThisWeek) {
      return -1;
    }
    if (!a.isThisWeek && b.isThisWeek) {
      return 1;
    }
    return 0;
  });

  const overdueCount = items.filter(i => i.isOverdue).length;
  const thisWeekCount = items.filter(i => i.isThisWeek).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4 text-red-600" />
              Immediate Attention - In Transit / Next 7 Days
            </CardTitle>
            <CardDescription>
              {items.length} shipments requiring attention
              {overdueCount > 0 && (
                <span className="text-red-600 ml-1">
                  ({overdueCount} delayed)
                </span>
              )}
              {thisWeekCount > 0 && (
                <span className="text-amber-600 ml-1">
                  ({thisWeekCount} this week)
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Load #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>Customer ETA/Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required / Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length > 0 ? (
                sortedItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.isOverdue
                        ? 'bg-red-50 hover:bg-red-100'
                        : item.isThisWeek
                        ? 'bg-amber-50 hover:bg-amber-100'
                        : ''
                    }
                  >
                    <TableCell className="font-medium">{item.loadNumber}</TableCell>
                    <TableCell>{item.customer}</TableCell>
                    <TableCell>{item.po}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell>{formatDate(item.etaPort)}</TableCell>
                    <TableCell>{formatDate(item.customerEtaDue)}</TableCell>
                    <TableCell>{getStatusBadge(item.status, item.isOverdue)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.actionRequired || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit?.(item)}
                          title="Edit Status"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* View and Note icons hidden for now
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onViewDetails?.(item)}
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onAddNote?.(item)}
                          title="Add Note"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No shipments require immediate attention
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
