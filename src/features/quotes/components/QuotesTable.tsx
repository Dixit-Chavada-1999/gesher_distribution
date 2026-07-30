'use client';

/**
 * QuotesTable Component
 *
 * Data table for displaying the list of quotes.
 * Uses the shared DataTable component with custom columns.
 *
 * All data is received via props - no internal data fetching.
 */

import { useMemo } from 'react';

import { DataTable } from '@/shared/components/data-table';

import { getQuotesTableColumns } from './QuotesTableColumns';
import type { QuotesTableProps } from '../types';

// ============================================
// COMPONENT
// ============================================

export function QuotesTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onConvert,
  toolbarContent,
}: QuotesTableProps) {
  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      getQuotesTableColumns({
        onView: onView || onRowClick,
        onEdit,
        onDelete,
        onConvert,
      }),
    [onView, onEdit, onDelete, onConvert, onRowClick]
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
      filterPlaceholder="Search quotes..."
      searchableColumns={['quoteNumber', 'customerName']}
      showPagination
      pageSizeOptions={[10, 20, 50, 100]}
      defaultPageSize={10}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      toolbarContent={toolbarContent}
      emptyState={
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-muted-foreground">No quotes found.</p>
          <p className="text-sm text-muted-foreground">
            Create your first quote to get started.
          </p>
        </div>
      }
    />
  );
}
