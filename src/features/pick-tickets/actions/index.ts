/**
 * Pick Tickets Server Actions
 *
 * Next.js server actions for Pick Tickets feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { PickTicketService } from '../services';
import { createClient } from '@/shared/lib/supabase/server';
import { db } from '@/shared/lib/supabase/database';
import type {
  PickTicket,
  PickTicketListParams,
  CreatePickTicketDTO,
  UpdatePickTicketDTO,
  PickItemDTO,
  PickTicketStatus,
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
// LIST PICK TICKETS
// ============================================

export async function listPickTickets(params: PickTicketListParams = {}) {
  const result = await PickTicketService.getPickTickets(params);
  return result;
}

// ============================================
// GET PICK TICKET
// ============================================

export async function getPickTicket(id: string) {
  const result = await PickTicketService.getPickTicketById(id);
  return result;
}

// ============================================
// GET PICK TICKETS BY SALES ORDER
// ============================================

export async function getPickTicketsBySalesOrder(salesOrderId: string) {
  const result = await PickTicketService.getPickTicketsBySalesOrderId(salesOrderId);
  return result;
}

// ============================================
// CREATE PICK TICKET
// ============================================

export async function createPickTicket(data: CreatePickTicketDTO) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.createPickTicket(data, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath('/sales-orders');
  }

  return result;
}

// ============================================
// UPDATE PICK TICKET
// ============================================

export async function updatePickTicket(id: string, data: UpdatePickTicketDTO) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.updatePickTicket(id, data, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// ASSIGN PICK TICKET
// ============================================

export async function assignPickTicket(id: string, assignedTo: string) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.assignPickTicket(id, assignedTo, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// START PICKING
// ============================================

export async function startPicking(id: string) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.startPicking(id, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// PICK ITEM
// ============================================

export async function pickItem(pickTicketId: string, item: PickItemDTO) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.pickItem(pickTicketId, item, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// PICK MULTIPLE ITEMS
// ============================================

export async function pickItems(pickTicketId: string, items: PickItemDTO[]) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.pickItems(pickTicketId, items, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// COMPLETE PICKING
// ============================================

export async function completePicking(id: string) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.completePicking(id, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// TRANSITION STATUS
// ============================================

export async function transitionPickTicketStatus(id: string, status: PickTicketStatus) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.transitionStatus(id, status, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// CANCEL PICK TICKET
// ============================================

export async function cancelPickTicket(id: string) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.cancelPickTicket(id, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// DELETE PICK TICKET
// ============================================

export async function deletePickTicket(id: string) {
  const userId = await getCurrentUserId();
  const result = await PickTicketService.deletePickTicket(id, userId);

  if (result.success) {
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// CREATE PICK TICKET FROM SALES ORDER
// ============================================

interface CreateFromSOResult {
  success: boolean;
  data?: PickTicket;
  error?: string;
}

export async function createPickTicketFromSalesOrder(
  salesOrderId: string,
  warehouseId: string
): Promise<CreateFromSOResult> {
  const userId = await getCurrentUserId();

  try {
    // Fetch sales order with items
    const { data: salesOrder, error: soError } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        warehouse_id,
        sales_order_items (
          id,
          product_id,
          sku,
          description,
          quantity
        )
      `)
      .eq('id', salesOrderId)
      .is('deleted_at', null)
      .single();

    if (soError || !salesOrder) {
      return {
        success: false,
        error: 'Sales order not found',
      };
    }

    // Check if sales order is confirmed or processing
    const { data: soStatus } = await db
      .from('sales_orders')
      .select('status')
      .eq('id', salesOrderId)
      .single();

    if (!soStatus || !['confirmed', 'processing'].includes(soStatus.status)) {
      return {
        success: false,
        error: 'Sales order must be confirmed or processing to create a pick ticket',
      };
    }

    // Check if pick ticket already exists for this sales order
    const { data: existingPT } = await db
      .from('pick_tickets')
      .select('id, pick_ticket_number')
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .limit(1);

    const firstExistingPT = existingPT?.[0];
    if (firstExistingPT) {
      return {
        success: false,
        error: `Pick ticket ${firstExistingPT.pick_ticket_number} already exists for this sales order`,
      };
    }

    // Prepare items for pick ticket
    const items = salesOrder.sales_order_items?.map((item: {
      id: string;
      product_id: string | null;
      sku: string;
      description: string | null;
      quantity: number;
    }) => ({
      salesOrderItemId: item.id,
      productId: item.product_id || '',
      sku: item.sku,
      description: item.description,
      quantityToPick: item.quantity,
    })) || [];

    if (items.length === 0) {
      return {
        success: false,
        error: 'Sales order has no items',
      };
    }

    // Create pick ticket
    const createDTO: CreatePickTicketDTO = {
      salesOrderId,
      warehouseId: warehouseId || salesOrder.warehouse_id,
      priority: 'normal',
      items,
    };

    const result = await PickTicketService.createPickTicket(createDTO, userId);

    if (result.success) {
      revalidatePath('/pick-tickets');
      revalidatePath('/sales-orders');
      revalidatePath(`/sales-orders/${salesOrderId}`);
    }

    return result;
  } catch (error) {
    console.error('[createPickTicketFromSalesOrder] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pick ticket',
    };
  }
}

// ============================================
// PACKING LIST ACTIONS
// Note: Import packing list actions directly from './packing-list.actions'
// Re-exporting from a 'use server' file is not allowed in Next.js
// ============================================
