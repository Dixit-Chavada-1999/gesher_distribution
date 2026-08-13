/**
 * Packing List Server Actions
 *
 * Next.js server actions for Packing Lists feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { PackingListService } from '../services';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  PackingListListParams,
  CreatePackingListDTO,
  PackingListStatus,
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

    if (!user) {
      return undefined;
    }

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
// LIST PACKING LISTS
// ============================================

export async function listPackingLists(params: PackingListListParams = {}) {
  const result = await PackingListService.getPackingLists(params);
  return result;
}

// ============================================
// GET PACKING LIST
// ============================================

export async function getPackingList(id: string) {
  const result = await PackingListService.getPackingListById(id);
  return result;
}

// ============================================
// GET PACKING LIST BY PICK TICKET
// ============================================

export async function getPackingListByPickTicket(pickTicketId: string) {
  const result = await PackingListService.getPackingListByPickTicketId(pickTicketId);
  return result;
}

// ============================================
// CREATE PACKING LIST
// ============================================

export async function createPackingList(data: CreatePackingListDTO) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.createPackingList(data, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// CREATE PACKING LIST FROM PICK TICKET
// ============================================

export async function createPackingListFromPickTicket(pickTicketId: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.createFromPickTicket(pickTicketId, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// MARK AS PACKED
// ============================================

export async function markPackingListAsPacked(id: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.markAsPacked(id, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath(`/packing-lists/${id}`);
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// TRANSITION STATUS
// ============================================

export async function transitionPackingListStatus(id: string, status: PackingListStatus) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.transitionStatus(id, status, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath(`/packing-lists/${id}`);
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// DELETE PACKING LIST
// ============================================

export async function deletePackingList(id: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.deletePackingList(id, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
  }

  return result;
}
