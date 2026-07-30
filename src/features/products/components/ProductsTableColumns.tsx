'use client';

/**
 * Products Table Columns
 *
 * Column definitions for the products data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';
import type { ProductTableRow } from '../types';

interface ColumnOptions {
  onEdit?: (product: ProductTableRow) => void;
  onDelete?: (product: ProductTableRow) => void;
  onView?: (product: ProductTableRow) => void;
}

export function getProductsTableColumns(options: ColumnOptions = {}): ColumnDef<ProductTableRow>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'sku',
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">{row.getValue('sku')}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => {
        const category = row.getValue('category') as string | null;
        return category ? (
          <Badge variant="outline">{category}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'formattedBaseCost',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue('formattedBaseCost')}
        </div>
      ),
    },
    {
      accessorKey: 'formattedBasePrice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue('formattedBasePrice')}
        </div>
      ),
    },
    {
      accessorKey: 'marginPercent',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Margin" />,
      cell: ({ row }) => {
        const marginPercent = row.getValue('marginPercent') as number;
        return (
          <div className="text-right">
            <Badge
              variant={marginPercent >= 20 ? 'default' : marginPercent >= 10 ? 'secondary' : 'destructive'}
              className="font-mono"
            >
              {marginPercent.toFixed(1)}%
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
          active: 'default',
          inactive: 'secondary',
          discontinued: 'destructive',
        };
        return (
          <Badge variant={statusColors[status] || 'secondary'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'isSellable',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sellable" />,
      cell: ({ row }) => {
        const isSellable = row.getValue('isSellable') as boolean;
        return (
          <Badge variant={isSellable ? 'default' : 'outline'}>
            {isSellable ? 'Yes' : 'No'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const actions = [];

        if (options.onView) {
          actions.push({
            label: 'View',
            onClick: () => options.onView?.(row.original),
          });
        }

        if (options.onEdit) {
          actions.push({
            label: 'Edit',
            onClick: () => options.onEdit?.(row.original),
          });
        }

        if (options.onDelete) {
          actions.push({
            label: 'Delete',
            onClick: () => options.onDelete?.(row.original),
            destructive: true,
          });
        }

        if (actions.length === 0) {
          return null;
        }

        return (
          <DataTableRowActions
            actions={actions}
            separatorAfter={options.onDelete && actions.length > 1 ? [actions.length - 2] : undefined}
          />
        );
      },
    },
  ];
}
