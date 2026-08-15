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
  PickTicketWithItems,
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

/**
 * Complete picking for a pick ticket
 * This reduces inventory (on_hand and allocated) for all picked items
 * Also auto-creates shipment with source='warehouse' for GDC1 Inventory
 *
 * Two fulfillment paths:
 * 1. Quick ship: picking/picked → shipped (via Complete Picking) - no packing list
 * 2. Full packing: picked → packing → packed → shipped (via Packing List flow)
 */
export async function completePicking(id: string) {
  const userId = await getCurrentUserId();

  // Get pick ticket with items before completing
  const ptResult = await PickTicketService.getPickTicketById(id);
  if (!ptResult.success || !ptResult.data) {
    return { success: false, error: 'Pick ticket not found' };
  }

  const pickTicket = ptResult.data;

  // Don't allow completion if a packing list already exists (user should use packing flow)
  if (pickTicket.packingList) {
    return {
      success: false,
      error: 'A packing list already exists. Please complete the packing flow instead.',
    };
  }

  // Complete the picking first (status change to 'shipped')
  const result = await PickTicketService.completePicking(id, userId);

  if (result.success) {
    // Ship inventory for each picked item
    await shipInventoryForPickTicket(pickTicket, userId);

    // Auto-create shipment with source='warehouse' for GDC1 Inventory
    // Shipment is created when items are actually picked and ready to ship
    try {
      await createShipmentFromCompletedPickTicket(pickTicket, userId);
    } catch (error) {
      console.error('[completePicking] Failed to create warehouse shipment:', error);
      // Don't fail the completion if shipment creation fails
    }

    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/operations');
  }

  return result;
}

/**
 * Helper: Ship inventory for completed pick ticket
 * Reduces on_hand and allocated for each picked item
 */
async function shipInventoryForPickTicket(
  pickTicket: PickTicketWithItems,
  userId?: string
): Promise<void> {
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  const reference = {
    type: 'pick_ticket',
    id: pickTicket.id,
    number: pickTicket.pickTicketNumber,
  };

  for (const item of pickTicket.items || []) {
    if (!item.productId || !pickTicket.warehouseId) {
      continue;
    }

    // Ship the quantity that was picked
    const quantityToShip = item.quantityPicked || item.quantityToPick;

    if (quantityToShip <= 0) {
      continue;
    }

    try {
      await inventoryService.shipByProductLocation(
        item.productId,
        pickTicket.warehouseId,
        quantityToShip,
        userId,
        reference
      );
    } catch (error) {
      // Log but don't fail - items might not have been allocated
      console.error(`Failed to ship inventory for ${item.sku}:`, error);
    }
  }
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

    // Allocate inventory for each item before creating pick ticket
    const { inventoryService } = await import('@/features/inventory/services/inventory.service');
    const finalWarehouseId = warehouseId || salesOrder.warehouse_id;
    const allocationErrors: string[] = [];

    for (const item of items) {
      if (!item.productId) {
        continue; // Skip items without product ID
      }

      const allocResult = await inventoryService.allocateByProductLocation(
        item.productId,
        finalWarehouseId,
        item.quantityToPick,
        userId,
        {
          type: 'sales_order',
          id: salesOrderId,
          number: salesOrder.order_number,
        }
      );

      if (!allocResult.success) {
        allocationErrors.push(`${item.sku}: ${allocResult.error}`);
      }
    }

    // If any allocation failed, return error
    if (allocationErrors.length > 0) {
      return {
        success: false,
        error: `Insufficient inventory: ${allocationErrors.join(', ')}`,
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

    if (result.success && result.data) {
      // Note: Shipment will be auto-created when Pick Ticket is COMPLETED (not here)
      // Pick Ticket CREATE = items need to be picked from warehouse
      // Pick Ticket COMPLETE = items picked, ready to ship → create shipment

      revalidatePath('/pick-tickets');
      revalidatePath('/sales-orders');
      revalidatePath(`/sales-orders/${salesOrderId}`);
      revalidatePath('/inventory');
      revalidatePath('/operations');
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

/**
 * Helper: Auto-create shipment from COMPLETED Pick Ticket for GDC1 Inventory (source='warehouse')
 * Called when Pick Ticket is completed (items picked, ready to ship)
 */
async function createShipmentFromCompletedPickTicket(
  pickTicket: PickTicketWithItems,
  userId?: string
): Promise<void> {
  if (!pickTicket.salesOrderId) {
    console.log('[completePicking] No sales order linked, skipping shipment creation');
    return;
  }

  // Generate shipment number
  const { data: shipmentNumber, error: numError } = await db.rpc('generate_shipment_number');
  if (numError) {
    throw new Error(`Failed to generate shipment number: ${numError.message}`);
  }

  // Get sales order with customer info
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
      requested_delivery_date,
      customers(id, name)
    `)
    .eq('id', pickTicket.salesOrderId)
    .single();

  if (!salesOrder) {
    console.log('[completePicking] Sales order not found, skipping shipment creation');
    return;
  }

  // Calculate total quantity from picked items
  const totalQty = (pickTicket.items || []).reduce((sum, item) => {
    return sum + (item.quantityPicked || item.quantityToPick);
  }, 0);

  // Create shipment with source='warehouse'
  const { data: shipment, error: shipmentError } = await db
    .from('shipments')
    .insert({
      shipment_number: shipmentNumber,
      shipment_date: new Date().toISOString().split('T')[0],
      sales_order_id: salesOrder.id,
      from_location_id: pickTicket.warehouseId,
      source: 'warehouse',
      load_status: 'in_transit', // Items are picked and ready to ship
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

  // Create shipment items from pick ticket items
  const shipmentItems = (pickTicket.items || []).map((item, index: number) => ({
    shipment_id: shipment.id,
    product_id: item.productId,
    sales_order_item_id: item.salesOrderItemId || null,
    sku: item.sku || '',
    description: item.description || null,
    quantity_shipped: item.quantityPicked || item.quantityToPick,
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

  console.log(`[Pick Ticket COMPLETE] Auto-created shipment ${shipmentNumber} with source='warehouse' for PT ${pickTicket.pickTicketNumber}`);
}

/**
 * Helper: Auto-create shipment from Pick Ticket for GDC1 Inventory (source='warehouse')
 * @deprecated Use createShipmentFromCompletedPickTicket instead - shipment should be created on COMPLETE, not CREATE
 */
async function createWarehouseShipment(
  pickTicket: PickTicket,
  salesOrder: { id: string; order_number: string; warehouse_id: string | null },
  items: Array<{ salesOrderItemId: string; productId: string; sku: string; description: string | null; quantityToPick: number }>,
  userId?: string
): Promise<void> {
  // Generate shipment number
  const { data: shipmentNumber, error: numError } = await db.rpc('generate_shipment_number');
  if (numError) {
    throw new Error(`Failed to generate shipment number: ${numError.message}`);
  }

  // Get sales order shipping address
  const { data: soAddress } = await db
    .from('sales_orders')
    .select(`
      ship_to_address_street,
      ship_to_address_city,
      ship_to_address_state,
      ship_to_address_postal_code,
      ship_to_address_country,
      ship_to_name,
      customer_po_number,
      requested_delivery_date
    `)
    .eq('id', salesOrder.id)
    .single();

  // Calculate total quantity
  const totalQty = items.reduce((sum: number, item) => sum + item.quantityToPick, 0);

  // Create shipment with source='warehouse'
  const { data: shipment, error: shipmentError } = await db
    .from('shipments')
    .insert({
      shipment_number: shipmentNumber,
      shipment_date: new Date().toISOString().split('T')[0],
      sales_order_id: salesOrder.id,
      from_location_id: pickTicket.warehouseId,
      source: 'warehouse',
      load_status: 'open',
      total_qty: totalQty,
      outstanding_qty: totalQty,
      ship_to_name: soAddress?.ship_to_name || null,
      ship_to_address_street: soAddress?.ship_to_address_street || null,
      ship_to_address_city: soAddress?.ship_to_address_city || null,
      ship_to_address_state: soAddress?.ship_to_address_state || null,
      ship_to_address_postal_code: soAddress?.ship_to_address_postal_code || null,
      ship_to_address_country: soAddress?.ship_to_address_country || null,
      customer_expected_delivery: soAddress?.requested_delivery_date || null,
      status: 'pending',
      created_by: userId || null,
      updated_by: userId || null,
    })
    .select()
    .single();

  if (shipmentError) {
    throw new Error(`Failed to create shipment: ${shipmentError.message}`);
  }

  // Create shipment items from pick ticket items
  const shipmentItems = items.map((item, index: number) => ({
    shipment_id: shipment.id,
    product_id: item.productId,
    sales_order_item_id: item.salesOrderItemId || null,
    sku: item.sku,
    description: item.description,
    quantity_shipped: item.quantityToPick,
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

  console.log(`[Pick Ticket] Auto-created shipment ${shipmentNumber} with source='warehouse' for PT ${pickTicket.pickTicketNumber}`);
}

// ============================================
// PACKING LIST ACTIONS
// Note: Import packing list actions directly from './packing-list.actions'
// Re-exporting from a 'use server' file is not allowed in Next.js
// ============================================
