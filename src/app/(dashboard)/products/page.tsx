/**
 * Products List Page
 *
 * Displays all products with filtering and pagination.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ProductsTable } from '@/features/products/components';
import { getProducts } from '@/features/products/actions';
import type { ProductTableRow } from '@/features/products/types';

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}

async function ProductsContent({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  const result = await getProducts({
    page: params.page ? parseInt(params.page) : 1,
    limit: params.limit ? parseInt(params.limit) : 10,
    search: params.search,
    status: params.status as 'active' | 'inactive' | 'discontinued' | undefined,
    category: params.category,
  });

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error || 'Failed to load products'}
      </div>
    );
  }

  const data = result.data as { data: ProductTableRow[]; meta: { totalPages: number } };

  return (
    <ProductsTable
      data={data.data}
      pageCount={data.meta.totalPages}
    />
  );
}

export default async function ProductsPage(props: ProductsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        actions={
          <Link href="/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </Link>
        }
      />

      <Suspense fallback={<LoadingState message="Loading products..." />}>
        <ProductsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
