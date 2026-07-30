/**
 * Shipments Server Actions
 *
 * Next.js server actions for Shipments feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { shipmentService } from '../services/shipment.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  ShipmentListParams,
  CreateShipmentDTO,
  UpdateShipmentDTO,
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
// LIST SHIPMENTS
// ============================================

export async function listShipments(params: ShipmentListParams = {}) {
  const result = await shipmentService.list(params);
  return result;
}

// ============================================
// GET SHIPMENT
// ============================================

export async function getShipment(id: string) {
  const result = await shipmentService.getById(id);
  return result;
}

// ============================================
// CREATE SHIPMENT
// ============================================

export async function createShipment(data: CreateShipmentDTO) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.create(data, userId);

  if (result.success) {
    revalidatePath('/shipments');
  }

  return result;
}

// ============================================
// UPDATE SHIPMENT
// ============================================

export async function updateShipment(id: string, data: UpdateShipmentDTO) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

// ============================================
// DELETE SHIPMENT
// ============================================

export async function deleteShipment(id: string) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.delete(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function markShipmentInTransit(id: string) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.markInTransit(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

export async function markShipmentDelivered(id: string) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.markDelivered(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

export async function markShipmentFailed(id: string) {
  const userId = await getCurrentUserId();
  const result = await shipmentService.markFailed(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}
