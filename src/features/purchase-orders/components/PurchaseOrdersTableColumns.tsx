'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { POListItem } from '../types';
import { PO_STATUS_COLORS, PO_STATUS_LABELS } from '../types';

interface ColumnsOptions {
  onView?: (po: POListItem) => void;
  onEdit?: (po: POListItem) => void;
  onDelete?: (po: POListItem) => void;
}

export function PurchaseOrdersTableColumns(options: ColumnsOptions = {}): ColumnDef<POListItem>[] {
  const { onView, onEdit, onDelete } = options;

  return [
    {
      accessorKey: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {row.original.poNumber}
            </span>
            <Badge
              variant="outline"
              className={cn('text-xs font-medium', PO_STATUS_COLORS[status])}
            >
              {PO_STATUS_LABELS[status]}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'supplierName',
      header: 'Supplier',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.supplierName}</p>
          <p className="text-xs text-muted-foreground">{row.original.supplierContact}</p>
        </div>
      ),
    },
    {
      accessorKey: 'poDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.poDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'expectedDeliveryDate',
      header: 'Expected Delivery',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.expectedDeliveryDate
            ? new Date(row.original.expectedDeliveryDate).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'grandTotal',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-medium">
          ${(row.original.grandTotal / 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const po = row.original;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(po)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                {onEdit && po.status === 'draft' && (
                  <DropdownMenuItem onClick={() => onEdit(po)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && po.status === 'draft' && (
                  <DropdownMenuItem
                    onClick={() => onDelete(po)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
