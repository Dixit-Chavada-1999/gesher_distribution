'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { PickTicketsTableColumns } from './PickTicketsTableColumns';
import type { PickTicketsTableProps, PickTicketListItem } from '../types';

export function PickTicketsTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onStartPicking,
  toolbarContent,
}: PickTicketsTableProps) {
  const [showShippedEditConfirm, setShowShippedEditConfirm] = useState(false);
  const [pendingEditPickTicket, setPendingEditPickTicket] = useState<PickTicketListItem | null>(null);

  // Wrap onEdit to check for shipped status and show confirmation
  const handleEdit = onEdit
    ? (pickTicket: PickTicketListItem) => {
        if (pickTicket.status === 'shipped') {
          setPendingEditPickTicket(pickTicket);
          setShowShippedEditConfirm(true);
        } else {
          onEdit(pickTicket);
        }
      }
    : undefined;

  const columns = PickTicketsTableColumns({ onView, onEdit: handleEdit, onDelete, onAssign, onStartPicking });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {toolbarContent && <div>{toolbarContent}</div>}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((_, index) => (
                  <TableHead key={index}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {toolbarContent && <div>{toolbarContent}</div>}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={onRowClick ? 'cursor-pointer' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No pick tickets found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirmation dialog for editing shipped pick tickets */}
      <AlertDialog open={showShippedEditConfirm} onOpenChange={setShowShippedEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit shipped pick ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This pick ticket has already been shipped. Editing shipped records may affect
              inventory tracking and shipment history.
              <br />
              <br />
              Are you sure you want to make changes to this shipped pick ticket?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEditPickTicket(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowShippedEditConfirm(false);
                if (pendingEditPickTicket && onEdit) {
                  onEdit(pendingEditPickTicket);
                }
                setPendingEditPickTicket(null);
              }}
            >
              Yes, Edit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
