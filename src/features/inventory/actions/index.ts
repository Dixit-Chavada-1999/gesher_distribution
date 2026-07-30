/**
 * Inventory Server Actions
 *
 * Next.js server actions for Inventory feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { inventoryService } from '../services/inventory.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
} from '../types';

// ============================================
// HELPER: Get current user ID
// ============================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return undefined;

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
// LIST INVENTORY
// ============================================

export async function listInventory(params: InventoryListParams = {}) {
  const result = await inventoryService.list(params);
  return result;
}

// ============================================
// GET INVENTORY
// ============================================

export async function getInventory(id: string) {
  const result = await inventoryService.getById(id);
  return result;
}

export async function getInventoryByProductAndLocation(
  productId: string,
  locationId: string
) {
  const result = await inventoryService.getByProductAndLocation(productId, locationId);
  return result;
}

// ============================================
// CREATE INVENTORY
// ============================================

export async function createInventory(data: CreateInventoryDTO) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.create(data, userId);

  if (result.success) {
    revalidatePath('/inventory');
  }

  return result;
}

// ============================================
// UPDATE INVENTORY
// ============================================

export async function updateInventory(id: string, data: UpdateInventoryDTO) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// ADJUST INVENTORY
// ============================================

export async function adjustInventory(id: string, adjustment: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.adjust(id, adjustment, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// ALLOCATE/DEALLOCATE INVENTORY
// ============================================

export async function allocateInventory(id: string, quantity: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.allocate(id, quantity, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

export async function deallocateInventory(id: string, quantity: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.deallocate(id, quantity, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// DELETE INVENTORY
// ============================================

export async function deleteInventory(id: string) {
  const result = await inventoryService.delete(id);

  if (result.success) {
    revalidatePath('/inventory');
  }

  return result;
}

// ============================================
// LOW STOCK
// ============================================

export async function getLowStockItems() {
  const result = await inventoryService.getLowStockItems();
  return result;
}
