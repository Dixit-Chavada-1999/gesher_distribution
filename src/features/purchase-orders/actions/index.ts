/**
 * Purchase Orders Server Actions
 *
 * Next.js server actions for Purchase Orders feature.
 *
 * Every action authenticates the caller and checks the matching
 * `purchase_orders.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { purchaseOrderService } from '../services/purchase-order.service';
import { createClient } from '@/shared/lib/supabase/server';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import type { POListParams, SupplierSummary } from '../types';
import type {
  CreatePOInput,
  UpdatePOInput,
} from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

/**
 * Same as `authorize`, but any one of the permissions is enough.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

// ============================================
// LIST PURCHASE ORDERS
// ============================================

export async function listPurchaseOrders(params: POListParams = {}) {
  const auth = await authorize('purchase_orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.list(params);
  return result;
}

// ============================================
// GET PURCHASE ORDER
// ============================================

export async function getPurchaseOrder(id: string) {
  const auth = await authorizeAny(['purchase_orders.view_detail', 'purchase_orders.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.getById(id);
  return result;
}

// ============================================
// CREATE PURCHASE ORDER
// ============================================

export async function createPurchaseOrder(data: CreatePOInput) {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.create(data, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// UPDATE PURCHASE ORDER
// ============================================

export async function updatePurchaseOrder(id: string, data: UpdatePOInput) {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.update(id, data, auth.user.id);

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
  const auth = await authorize('purchase_orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.delete(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function sendPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.send');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.send(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function confirmPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.confirm');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.confirm(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderPartial(id: string) {
  const auth = await authorize('purchase_orders.receive');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.markPartial(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderReceived(id: string) {
  const auth = await authorize('purchase_orders.receive');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.markReceived(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function cancelPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.cancel');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.cancel(id, auth.user.id);

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
  const auth = await authorize('purchase_orders.view_module');
  if (!auth.ok) {
    return [];
  }

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
