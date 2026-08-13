'use server';

/**
 * Supplier Portal Server Actions
 *
 * Server actions for supplier portal operations.
 * All actions verify the user is a supplier and has appropriate permissions.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as service from '../services/supplier-portal.service';
import type {
  ConfirmPOInput,
  RejectPOInput,
  UpdateProductionInput,
  UpdateShipmentInput,
} from '../types';

// ============================================
// HELPER
// ============================================

async function getSupplierUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: 'Authentication required' };
  }
  if (!user.supplierId) {
    return { user: null, error: 'Not a supplier user' };
  }
  return { user, error: null };
}

// ============================================
// PURCHASE ORDER ACTIONS
// ============================================

export async function confirmPurchaseOrderAction(
  input: ConfirmPOInput
): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.confirm_po')) {
    return { success: false, error: 'Permission denied' };
  }

  const result = await service.confirmPO(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);
    revalidatePath('/supplier-portal/shipments');

    // Revalidate operations dashboard (Jenny's dashboard)
    revalidatePath('/operations');
  }

  return result;
}

export async function rejectPurchaseOrderAction(
  input: RejectPOInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.reject_po')) {
    return { success: false, error: 'Permission denied' };
  }

  const result = await service.rejectPO(input, user.id);

  if (result.success) {
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);
  }

  return result;
}

export async function updateProductionStatusAction(
  input: UpdateProductionInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.update_production')) {
    return { success: false, error: 'Permission denied' };
  }

  const result = await service.updateProduction(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);
    revalidatePath('/supplier-portal/shipments');

    // Revalidate operations dashboard (Jenny's dashboard)
    // Important when production status changes to "shipped" - shipment becomes in_transit
    revalidatePath('/operations');
  }

  return result;
}

// ============================================
// SHIPMENT ACTIONS
// ============================================

export async function updateShipmentAction(
  input: UpdateShipmentInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.update_shipment')) {
    return { success: false, error: 'Permission denied' };
  }

  const result = await service.updateShipmentDetails(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/shipments');
    revalidatePath(`/supplier-portal/shipments/${input.shipmentId}`);

    // Revalidate operations dashboard (Jenny's dashboard)
    revalidatePath('/operations');
  }

  return result;
}
