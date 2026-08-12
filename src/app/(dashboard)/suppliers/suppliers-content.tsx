'use client';

/**
 * Suppliers Page Content
 *
 * Client component for suppliers list with dialog functionality.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

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
