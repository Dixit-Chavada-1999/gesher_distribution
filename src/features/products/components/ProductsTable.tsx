'use client';

/**
 * Products Table Component
 *
 * Data table for displaying and managing products.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { getProductsTableColumns } from './ProductsTableColumns';
import type { ProductTableRow } from '../types';
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
import { toast } from 'sonner';
import { deleteProduct } from '../actions';

interface ProductsTableProps {
  data: ProductTableRow[];
  pageCount?: number;
  isLoading?: boolean;
}

export function ProductsTable({ data, pageCount = 1, isLoading = false }: ProductsTableProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleView = useCallback(
    (product: ProductTableRow) => {
      router.push(`/products/${product.id}`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (product: ProductTableRow) => {
      router.push(`/products/${product.id}/edit`);
    },
    [router]
  );

  const handleDeleteClick = useCallback((product: ProductTableRow) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!productToDelete) {return;}

    setIsDeleting(true);
    try {
      const result = await deleteProduct(productToDelete.id);

      if (result.success) {
        toast.success('Product deleted successfully');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete product');
      }
    } catch {
      toast.error('An error occurred while deleting the product');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const columns = getProductsTableColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        pageCount={pageCount}
        filterColumn="name"
        filterPlaceholder="Filter products..."
        isLoading={isLoading}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{productToDelete?.name}</span>? This
              action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
