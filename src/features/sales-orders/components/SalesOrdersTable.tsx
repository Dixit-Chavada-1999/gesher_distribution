'use client';

/**
 * SalesOrdersTable Component
 *
 * Data table for displaying the list of sales orders.
 * Uses the shared DataTable component with custom columns.
 *
 * All data is received via props - no internal data fetching.
 */

import { useMemo } from 'react';

import { DataTable } from '@/shared/components/data-table';

import { getSalesOrdersTableColumns } from './SalesOrdersTableColumns';
import type { SalesOrdersTableProps } from '../types';

// ============================================
// COMPONENT
// ============================================

export function SalesOrdersTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onConfirm,
  onCancel,
  toolbarContent,
}: SalesOrdersTableProps) {
  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      getSalesOrdersTableColumns({
        onView: onView || onRowClick,
        onEdit,
        onDelete,
        onConfirm,
        onCancel,
      }),
    [onView, onEdit, onDelete, onConfirm, onCancel, onRowClick]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      enableRowSelection
      enableColumnVisibility
      enableGlobalFilter
      filterPlaceholder="Search orders..."
      searchableColumns={['orderNumber', 'customerName']}
      showPagination
      pageSizeOptions={[10, 20, 50, 100]}
      defaultPageSize={10}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      toolbarContent={toolbarContent}
      emptyState={
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-muted-foreground">No sales orders found.</p>
          <p className="text-sm text-muted-foreground">
            Create your first sales order to get started.
          </p>
        </div>
      }
    />
  );
}
