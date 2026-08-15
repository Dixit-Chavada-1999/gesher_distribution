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
  PackingListWithItems,
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

  if (result.success && result.data) {
    // When transitioning to 'shipped', create the warehouse shipment
    if (status === 'shipped') {
      try {
        await createShipmentFromPackingList(result.data, userId);
      } catch (error) {
        console.error('[transitionPackingListStatus] Failed to create shipment:', error);
        // Don't fail the transition if shipment creation fails
      }
    }

    revalidatePath('/packing-lists');
    revalidatePath(`/packing-lists/${id}`);
    revalidatePath('/pick-tickets');
    revalidatePath('/inventory');
    revalidatePath('/operations');
  }

  return result;
}

/**
 * Helper: Create shipment from shipped packing list
 */
async function createShipmentFromPackingList(
  packingList: PackingListWithItems,
  userId?: string
): Promise<void> {
  const { db } = await import('@/shared/lib/supabase/database');
  const { PickTicketService } = await import('../services');

  // Get pick ticket details
  const ptResult = await PickTicketService.getPickTicketById(packingList.pickTicketId);
  if (!ptResult.success || !ptResult.data) {
    console.log('[transitionPackingListStatus] Pick ticket not found, skipping shipment creation');
    return;
  }

  const pickTicket = ptResult.data;

  if (!pickTicket.salesOrderId) {
    console.log('[transitionPackingListStatus] No sales order linked, skipping shipment creation');
    return;
  }

  // Generate shipment number
  const { data: shipmentNumber, error: numError } = await db.rpc('generate_shipment_number');
  if (numError || !shipmentNumber) {
    throw new Error(`Failed to generate shipment number: ${numError?.message}`);
  }

  // Get sales order details
  const { data: salesOrder } = await db
    .from('sales_orders')
    .select(`
      id,
      order_number,
      ship_to_address_street,
      ship_to_address_city,
      ship_to_address_state,
      ship_to_address_postal_code,
      ship_to_address_country,
      ship_to_name,
      customer_po_number,
      requested_delivery_date
    `)
    .eq('id', pickTicket.salesOrderId)
    .single();

  if (!salesOrder) {
    console.log('[transitionPackingListStatus] Sales order not found, skipping shipment creation');
    return;
  }

  // Calculate total quantity from packing list items
  const totalQty = (packingList.items || []).reduce((sum, item) => sum + item.quantityPacked, 0);

  // Create shipment with source='warehouse'
  const { data: shipment, error: shipmentError } = await db
    .from('shipments')
    .insert({
      shipment_number: shipmentNumber,
      shipment_date: new Date().toISOString().split('T')[0],
      sales_order_id: salesOrder.id,
      from_location_id: pickTicket.warehouseId,
      source: 'warehouse',
      load_status: 'in_transit',
      total_qty: totalQty,
      outstanding_qty: totalQty,
      ship_to_name: salesOrder.ship_to_name || null,
      ship_to_address_street: salesOrder.ship_to_address_street || null,
      ship_to_address_city: salesOrder.ship_to_address_city || null,
      ship_to_address_state: salesOrder.ship_to_address_state || null,
      ship_to_address_postal_code: salesOrder.ship_to_address_postal_code || null,
      ship_to_address_country: salesOrder.ship_to_address_country || null,
      customer_expected_delivery: salesOrder.requested_delivery_date || null,
      status: 'in_transit',
      created_by: userId || null,
      updated_by: userId || null,
    })
    .select()
    .single();

  if (shipmentError) {
    throw new Error(`Failed to create shipment: ${shipmentError.message}`);
  }

  // Create shipment items from packing list items
  const shipmentItems = (packingList.items || []).map((item, index) => ({
    shipment_id: shipment.id,
    product_id: item.productId,
    sku: item.sku,
    description: item.description || null,
    quantity_shipped: item.quantityPacked,
    sort_order: index,
    created_by: userId || null,
    updated_by: userId || null,
  }));

  if (shipmentItems.length > 0) {
    const { error: itemsError } = await db
      .from('shipment_items')
      .insert(shipmentItems);

    if (itemsError) {
      // Clean up shipment if items insertion fails
      await db.from('shipments').delete().eq('id', shipment.id);
      throw new Error(`Failed to create shipment items: ${itemsError.message}`);
    }
  }

  // Link packing list to shipment
  await db
    .from('packing_lists')
    .update({ shipment_id: shipment.id })
    .eq('id', packingList.id);

  // Ship inventory for each packed item
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  for (const item of packingList.items || []) {
    if (!item.productId || !pickTicket.warehouseId) {
      continue;
    }

    try {
      await inventoryService.shipByProductLocation(
        item.productId,
        pickTicket.warehouseId,
        item.quantityPacked,
        userId,
        {
          type: 'packing_list',
          id: packingList.id,
          number: packingList.packingListNumber,
        }
      );
    } catch (error) {
      console.error(`Failed to ship inventory for ${item.sku}:`, error);
    }
  }

  console.log(`[Packing List SHIPPED] Created shipment ${shipmentNumber} with source='warehouse' for PL ${packingList.packingListNumber}`);
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
