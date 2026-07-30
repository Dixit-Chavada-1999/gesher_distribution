/**
 * Customer Detail Page
 *
 * /customers/[id]
 *
 * Full page view for customer details with tabs for Details, Contacts, and Documents.
 */

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import { getCustomer } from '@/features/customers/actions';
import { CustomerDetailView } from '@/features/customers/components/CustomerDetailView';

// ============================================
// TYPES
// ============================================

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  // Fetch customer data
  const result = await getCustomer(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CustomerDetailView customer={result.data} />
    </Suspense>
  );
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const result = await getCustomer(id);

  if (!result.success || !result.data) {
    return {
      title: 'Customer Not Found',
    };
  }

  return {
    title: `${result.data.name} | Customers`,
    description: `View details for customer ${result.data.customerCode}`,
  };
}
