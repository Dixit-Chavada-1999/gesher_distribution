'use client';

/**
 * Suppliers Page Content
 *
 * Client component for suppliers list with dialog functionality.
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { SuppliersTable, SupplierFormDialog } from '@/features/suppliers';
import type { Supplier } from '@/features/suppliers/types';

interface SuppliersPageContentProps {
  suppliers: Supplier[];
  total: number;
  canCreate: boolean;
  canEdit: boolean;
}

export function SuppliersPageContent({
  suppliers,
  total,
  canCreate,
  canEdit,
}: SuppliersPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Pagination
  const pageSize = 20;
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const totalPages = Math.ceil(total / pageSize);

  const handleCreate = useCallback(() => {
    setEditingSupplier(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', newPage.toString());
      router.push(`/suppliers?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage supplier companies and portal access
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Suppliers ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SuppliersTable
            suppliers={suppliers}
            onEdit={canEdit ? handleEdit : undefined}
          />
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, total)} of {total} results
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Supplier Form Dialog */}
      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
