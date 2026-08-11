/**
 * Supplier Purchase Order Detail Page
 */

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierPODetail, supplierPortalService } from '@/features/supplier-portal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const po = await supplierPortalService.getPurchaseOrderById(id);

  return {
    title: po ? `${po.poNumber} | Supplier Portal` : 'Purchase Order | Supplier Portal',
    description: 'Purchase order details',
  };
}

export default async function SupplierPurchaseOrderDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_pos')) {
    redirect('/no-permission');
  }

  const purchaseOrder = await supplierPortalService.getPurchaseOrderById(id);

  if (!purchaseOrder) {
    notFound();
  }

  // Verify this PO belongs to the supplier
  if (purchaseOrder.supplierId !== user.supplierId) {
    redirect('/supplier-portal/purchase-orders');
  }

  return <SupplierPODetail purchaseOrder={purchaseOrder} />;
}
