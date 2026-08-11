/**
 * Purchase Orders Server Actions
 *
 * Next.js server actions for Purchase Orders feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { purchaseOrderService } from '../services/purchase-order.service';
import { createClient } from '@/shared/lib/supabase/server';
import type { POListParams, SupplierSummary } from '../types';
import type {
  CreatePOInput,
  UpdatePOInput,
} from '../lib/schemas';

// ============================================
// HELPER: Get current user ID
// ============================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {return undefined;}

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    return data?.id;
  } catch {
    return undefined;
  }
}

// ============================================
// LIST PURCHASE ORDERS
// ============================================

export async function listPurchaseOrders(params: POListParams = {}) {
  const result = await purchaseOrderService.list(params);
  return result;
}

// ============================================
// GET PURCHASE ORDER
// ============================================

export async function getPurchaseOrder(id: string) {
  const result = await purchaseOrderService.getById(id);
  return result;
}

// ============================================
// CREATE PURCHASE ORDER
// ============================================

export async function createPurchaseOrder(data: CreatePOInput) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.create(data, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// UPDATE PURCHASE ORDER
// ============================================

export async function updatePurchaseOrder(id: string, data: UpdatePOInput) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

// ============================================
// DELETE PURCHASE ORDER
// ============================================

export async function deletePurchaseOrder(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.delete(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function sendPurchaseOrder(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.send(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function confirmPurchaseOrder(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.confirm(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderPartial(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.markPartial(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderReceived(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.markReceived(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function cancelPurchaseOrder(id: string) {
  const userId = await getCurrentUserId();
  const result = await purchaseOrderService.cancel(id, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

// ============================================
// GET SUPPLIERS FOR DROPDOWN
// ============================================

export async function getSuppliersForDropdown(): Promise<SupplierSummary[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, primary_contact_name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[getSuppliersForDropdown] Error:', error);
      return [];
    }

    return (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      primaryContactName: s.primary_contact_name,
    }));
  } catch (err) {
    console.error('[getSuppliersForDropdown] Error:', err);
    return [];
  }
}
