'use client';

/**
 * Suppliers Table
 *
 * Admin table view for managing suppliers.
 */

import Link from 'next/link';
import { MoreHorizontal, Edit, Trash2, Eye, Building2 } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn, formatDate } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores';
import type { Supplier, SupplierStatus } from '../types';

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: SupplierStatus) {
  const configs: Record<SupplierStatus, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  };

  const config = configs[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SuppliersTableProps {
  suppliers: Supplier[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

export function SuppliersTable({ suppliers, onEdit, onDelete }: SuppliersTableProps) {
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('suppliers.edit');
  const canDelete = hasPermission('suppliers.delete');

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No suppliers found.</p>
        <p className="text-sm text-muted-foreground">
          Create a supplier to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.supplierCode}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{supplier.name}</p>
                  {supplier.legalName && (
                    <p className="text-sm text-muted-foreground">
                      {supplier.legalName}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {supplier.primaryContactName && (
                    <p>{supplier.primaryContactName}</p>
                  )}
                  {supplier.primaryContactEmail && (
                    <p className="text-muted-foreground">
                      {supplier.primaryContactEmail}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(supplier.status)}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(supplier.createdAt)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/suppliers/${supplier.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    {canEdit && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(supplier)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDelete?.(supplier)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
