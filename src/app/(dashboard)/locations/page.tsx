/**
 * Locations List Page
 *
 * Displays all locations with filtering and pagination.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { LocationsTable } from '@/features/locations/components';
import { getLocations } from '@/features/locations/actions';
import type { LocationTableRow } from '@/features/locations/types';

interface LocationsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    locationType?: string;
    isActive?: string;
  }>;
}

async function LocationsContent({ searchParams }: LocationsPageProps) {
  const params = await searchParams;

  const result = await getLocations({
    page: params.page ? parseInt(params.page) : 1,
    limit: params.limit ? parseInt(params.limit) : 10,
    search: params.search,
    locationType: params.locationType as 'warehouse' | 'drop_ship' | 'virtual' | undefined,
    isActive: params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined,
  });

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error || 'Failed to load locations'}
      </div>
    );
  }

  const data = result.data as { data: LocationTableRow[]; meta: { totalPages: number } };

  return (
    <LocationsTable
      data={data.data}
      pageCount={data.meta.totalPages}
    />
  );
}

export default async function LocationsPage(props: LocationsPageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locations"
        description="Manage warehouse and shipping locations"
        actions={
          <Link href="/locations/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </Link>
        }
      />

      <Suspense fallback={<LoadingState message="Loading locations..." />}>
        <LocationsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
