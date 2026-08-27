/**
 * Pick Tickets Server Actions
 *
 * Next.js server actions for Pick Tickets feature.
 *
 * Every action authenticates the caller and checks the matching
 * `pick_tickets.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { PickTicketService } from '../services';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import type {
  PickTicket,
  PickTicketWithItems,
  PickTicketListParams,
  CreatePickTicketDTO,
  UpdatePickTicketDTO,
  PickItemDTO,
  PickTicketStatus,
  PickTicketPdfSalesOrderFields,
} from '../types';

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
// LIST PICK TICKETS
// ============================================

export async function listPickTickets(params: PickTicketListParams = {}) {
  const auth = await authorize('pick_tickets.view');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTickets(params);
  return result;
}

// ============================================
// GET PICK TICKET
// ============================================

export async function getPickTicket(id: string) {
  const auth = await authorizeAny(['pick_tickets.view', 'pick_tickets.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketById(id);
  return result;
}

// ============================================
// GET PICK TICKETS BY SALES ORDER
// ============================================

/**
 * Everything the pick ticket PDF needs, in one authorized call.
 *
 * The pick ticket join does not carry the ship-to address, the required date
 * or the customer PO, so those are read from the sales order here rather than
 * in the API route — routes in this codebase never touch `db` directly.
 */
export async function getPickTicketPdfData(
  id: string
): Promise<ActionResult<{ pickTicket: PickTicketWithItems; salesOrder: PickTicketPdfSalesOrderFields | null }>> {
  const auth = await authorizeAny(['pick_tickets.view', 'pick_tickets.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketById(id);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Pick ticket not found' };
  }

  const pickTicket = result.data;
  let salesOrder: PickTicketPdfSalesOrderFields | null = null;

  if (pickTicket.salesOrderId) {
    const { data, error } = await db
      .from('sales_orders')
      .select(
        `
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        requested_delivery_date,
        customer_po_number
      `
      )
      .eq('id', pickTicket.salesOrderId)
      .single();

    if (error) {
      // The PDF is still useful without these fields, so log and carry on.
      console.error('[getPickTicketPdfData] Sales order lookup failed:', error);
    } else {
      salesOrder = data as unknown as PickTicketPdfSalesOrderFields;
    }
  }

  return { success: true, data: { pickTicket, salesOrder } };
}

export async function getPickTicketsBySalesOrder(salesOrderId: string) {
  const auth = await authorize('pick_tickets.view');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketsBySalesOrderId(salesOrderId);
  return result;
}

// ============================================
// CREATE PICK TICKET
// ============================================

export async function createPickTicket(data: CreatePickTicketDTO) {
  const auth = await authorize('pick_tickets.create');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.createPickTicket(data, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath('/sales-orders');
  }

  return result;
}

// ============================================
// UPDATE PICK TICKET
// ============================================

/**
 * Update pick ticket with proper status transition handling.
 *
 * When status is changed via Edit dialog, we trigger the same
 * business logic that would run via normal workflow buttons:
 *
 * - To 'picked': Auto-set quantity_picked = quantity_to_pick for all items
 * - To 'shipped': Ship inventory + Create shipment (if not via packing list)
 * - To 'packed': Only allowed via Packing List flow (blocked here)
 */
export async function updatePickTicket(id: string, data: UpdatePickTicketDTO) {
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  // Get current pick ticket to check status transition
  const currentPT = await PickTicketService.getPickTicketById(id);
  if (!currentPT.success || !currentPT.data) {
    return { success: false, error: 'Pick ticket not found' };
  }

  const oldStatus = currentPT.data.status;
  const newStatus = data.status;
  const pickTicket = currentPT.data;

  // Block transition to 'packed' - must use Packing List workflow
  if (newStatus === 'packed' && oldStatus !== 'packed') {
    // Provide context-specific error message
    if (pickTicket.packingList) {
      return {
        success: false,
        error: 'Cannot change status to "packed" here. Please go to Packing Lists and mark the packing list as "Packed" instead. This will automatically update the pick ticket status.',
      };
    }
    // Special case: status is 'packing' but no packing list exists (data inconsistency)
    if (oldStatus === 'packing') {
      return {
        success: false,
        error: 'Status is "packing" but no Packing List found. Please change status to "picked" first, then create a new Packing List.',
      };
    }
    return {
      success: false,
      error: 'Cannot change status to "packed" directly. Please create a Packing List first, then mark it as "Packed".',
    };
  }

  // Allow reverting from 'packing' to 'picked' if no packing list exists (data cleanup)
  if (newStatus === 'picked' && oldStatus === 'packing' && !pickTicket.packingList) {
    console.log('[updatePickTicket] Allowing revert from "packing" to "picked" - no packing list exists (data cleanup)');
    // Continue with normal update - no special handling needed
  }

  // Handle transition to 'picked' status - auto-set quantity_picked
  if (newStatus === 'picked' && oldStatus !== 'picked') {
    // If items are not provided with quantities, auto-set quantity_picked = quantity_to_pick
    if (!data.items || data.items.length === 0) {
      const autoItems = pickTicket.items.map((item) => ({
        id: item.id,
        quantityPicked: item.quantityToPick,
      }));
      data.items = autoItems;
      console.log('[updatePickTicket] Auto-setting quantity_picked for transition to "picked"');
    }
  }

  // Handle transition to 'shipped' status (direct ship without packing list)
  if (newStatus === 'shipped' && oldStatus !== 'shipped') {
    // Check if packing list exists - if yes, should use packing list flow
    if (pickTicket.packingList) {
      return {
        success: false,
        error: 'A packing list exists for this pick ticket. Please mark the packing list as "shipped" instead.',
      };
    }

    // Auto-set quantity_picked if transitioning from non-picked status
    if (oldStatus !== 'picked' && (!data.items || data.items.length === 0)) {
      const autoItems = pickTicket.items.map((item) => ({
        id: item.id,
        quantityPicked: item.quantityToPick,
      }));
      data.items = autoItems;
      console.log('[updatePickTicket] Auto-setting quantity_picked for transition to "shipped"');
    }
  }

  // Perform the update
  const result = await PickTicketService.updatePickTicket(id, data, auth.user.id);

  if (result.success) {
    // If transitioning to 'shipped', trigger inventory ship and shipment creation
    if (newStatus === 'shipped' && oldStatus !== 'shipped') {
      // Refresh pick ticket data after update to get updated quantities
      const updatedPT = await PickTicketService.getPickTicketById(id);
      if (updatedPT.success && updatedPT.data) {
        // Ship inventory for each picked item
        try {
          await shipInventoryForPickTicket(updatedPT.data, auth.user.id);
          console.log('[updatePickTicket] Inventory shipped for status transition to "shipped"');
        } catch (error) {
          console.error('[updatePickTicket] Failed to ship inventory:', error);
        }

        // Create shipment record
        try {
          await createShipmentFromCompletedPickTicket(updatedPT.data, auth.user.id);
          console.log('[updatePickTicket] Shipment created for status transition to "shipped"');
        } catch (error) {
          console.error('[updatePickTicket] Failed to create shipment:', error);
          // Return success with warning - don't fail the update
          revalidatePath('/pick-tickets');
          revalidatePath(`/pick-tickets/${id}`);
          revalidatePath('/inventory');
          revalidatePath('/operations');
          revalidatePath('/shipments');
          return {
            success: true,
            data: result.data,
            warning: `Status updated to "shipped" but shipment could not be created: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }

      // Revalidate all related paths
      revalidatePath('/inventory');
      revalidatePath('/operations');
      revalidatePath('/shipments');
    }

    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// ASSIGN PICK TICKET
// ============================================

export async function assignPickTicket(id: string, assignedTo: string) {
  const auth = await authorize('pick_tickets.assign');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.assignPickTicket(id, assignedTo, auth.user.id);

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
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.startPicking(id, auth.user.id);

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
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.pickItem(pickTicketId, item, auth.user.id);

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
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.pickItems(pickTicketId, items, auth.user.id);

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
 * 1. Quick ship: picking/picked â†' shipped (via Complete Picking) - no packing list
 * 2. Full packing: picked â†' packing â†' packed â†' shipped (via Packing List flow)
 */
export async function completePicking(id: string) {
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

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
  const result = await PickTicketService.completePicking(id, auth.user.id);

  if (result.success) {
    // Ship inventory for each picked item
    await shipInventoryForPickTicket(pickTicket, auth.user.id);

    // Auto-create shipment with source='warehouse' for GDC1 Inventory
    // Shipment is created when items are actually picked and ready to ship
    // The picking is already committed at this point, so a shipment failure
    // must not roll it back — but it must never be silent either: without a
    // shipment the order simply disappears from the Shipments page.
    let shipmentWarning: string | undefined;
    try {
      await createShipmentFromCompletedPickTicket(pickTicket, auth.user.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[completePicking] Failed to create warehouse shipment:', error);
      shipmentWarning = `Picking completed, but the shipment could not be created: ${detail}`;
    }

    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/operations');
    revalidatePath('/shipments');

    if (shipmentWarning) {
      return { ...result, warning: shipmentWarning };
    }
  }

  return result;
}

/**
 * Helper: Ship inventory for completed pick ticket
 * Reduces on_hand and allocated for each picked item
 * Skips service and non-inventory items (they don't have physical inventory)
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

  // Fetch product item_type for all products in the pick ticket
  const productIds = (pickTicket.items || [])
    .map((item) => item.productId)
    .filter((id): id is string => !!id);

  let productItemTypes: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await db
      .from('products')
      .select('id, item_type')
      .in('id', productIds);

    productItemTypes = (products || []).reduce((acc, p) => {
      acc[p.id] = p.item_type || 'inventory';
      return acc;
    }, {} as Record<string, string>);
  }

  for (const item of pickTicket.items || []) {
    if (!item.productId || !pickTicket.warehouseId) {
      continue;
    }

    // Skip service and non-inventory items - they don't have physical inventory
    const itemType = productItemTypes[item.productId] || 'inventory';
    if (itemType === 'service' || itemType === 'non_inventory') {
      console.log(`[shipInventoryForPickTicket] Skipping inventory ship for ${item.sku} (${itemType})`);
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
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.transitionStatus(id, status, auth.user.id);

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
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.cancelPickTicket(id, auth.user.id);

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
  const auth = await authorize('pick_tickets.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.deletePickTicket(id, auth.user.id);

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
  warehouseId: string,
  notifyContactIds?: string[],
  specialInstructions?: string
): Promise<CreateFromSOResult> {
  const auth = await authorize('pick_tickets.create');
  if (!auth.ok) {
    return auth.result;
  }

  const userId = auth.user.id;

  try {
    // Fetch sales order with items and customer info (including product item_type)
    const { data: salesOrder, error: soError } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        warehouse_id,
        customer_id,
        customer_po_number,
        requested_delivery_date,
        internal_notes,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        sales_order_items (
          id,
          product_id,
          sku,
          description,
          quantity,
          products (
            item_type
          )
        )
      `)
      .eq('id', salesOrderId)
      .is('deleted_at', null)
      .single();

    if (soError || !salesOrder) {
      console.error('[createPickTicketFromSalesOrder] Query error:', soError);
      console.error('[createPickTicketFromSalesOrder] salesOrderId:', salesOrderId);
      return {
        success: false,
        error: soError?.message || 'Sales order not found',
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

    // Prepare items for pick ticket - ONLY include physical inventory items
    // Service and non-inventory items don't need to be picked from warehouse
    // Note: Supabase returns products as array due to join, so we access first element
    const allItems = salesOrder.sales_order_items?.map((item: {
      id: string;
      product_id: string | null;
      sku: string;
      description: string | null;
      quantity: number;
      products: { item_type: string }[] | { item_type: string } | null;
    }) => {
      // Handle both array (Supabase default) and single object cases
      const productData = Array.isArray(item.products) ? item.products[0] : item.products;
      return {
        salesOrderItemId: item.id,
        productId: item.product_id || '',
        sku: item.sku,
        description: item.description,
        quantityToPick: item.quantity,
        itemType: productData?.item_type || 'inventory', // Default to inventory if not set
      };
    }) || [];

    // Filter to only include physical inventory items (exclude service and non_inventory)
    const items = allItems.filter((item) => {
      if (item.itemType === 'service' || item.itemType === 'non_inventory') {
        console.log(`[createPickTicketFromSalesOrder] Excluding ${item.sku} from pick ticket (${item.itemType} - not a physical item)`);
        return false;
      }
      return true;
    });

    if (items.length === 0) {
      return {
        success: false,
        error: 'Sales order has no physical inventory items to pick',
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
      // Pick Ticket COMPLETE = items picked, ready to ship -> create shipment

      // Send pick ticket email to selected contacts with PDF attachment
      if (notifyContactIds && notifyContactIds.length > 0) {
        try {
          // Get warehouse details
          const { data: warehouse } = await db
            .from('locations')
            .select('name, location_code')
            .eq('id', finalWarehouseId)
            .single();

          // Build ship to address
          const shipToAddress = [
            salesOrder.shipping_address_street,
            [salesOrder.shipping_address_city, salesOrder.shipping_address_state, salesOrder.shipping_address_postal_code]
              .filter(Boolean)
              .join(', '),
          ].filter(Boolean).join(', ');

          // Get customer name
          let customerName = 'Unknown Customer';
          if (salesOrder.customer_id) {
            const { data: customer } = await db
              .from('customers')
              .select('name')
              .eq('id', salesOrder.customer_id)
              .single();
            customerName = customer?.name || 'Unknown Customer';
          }

          const { sendPickTicketEmails } = await import('../services/email.service');
          const emailResult = await sendPickTicketEmails({
            pickTicketId: result.data.id,
            pickTicketNumber: result.data.pickTicketNumber,
            salesOrderNumber: salesOrder.order_number,
            warehouseName: warehouse?.name || 'Warehouse',
            warehouseCode: warehouse?.location_code || '',
            contactIds: notifyContactIds,
            customerName,
            shipToAddress: shipToAddress || 'N/A',
            requiredDate: salesOrder.requested_delivery_date,
            customerPoNumber: salesOrder.customer_po_number,
            notes: specialInstructions || salesOrder.internal_notes,
            // Only include physical inventory items in email (same as pick ticket)
            items: items.map((item) => ({
              sku: item.sku,
              productName: item.description || item.sku,
              quantity: item.quantityToPick,
              uom: 'EA',
            })),
          });

          if (emailResult.sentTo.length > 0) {
            console.log(`[createPickTicketFromSalesOrder] Emails sent to: ${emailResult.sentTo.join(', ')}`);
          }
          if (emailResult.errors.length > 0) {
            console.error(`[createPickTicketFromSalesOrder] Email errors: ${emailResult.errors.join(', ')}`);
          }
        } catch (emailError) {
          // Don't fail pick ticket creation if email fails
          console.error('[createPickTicketFromSalesOrder] Failed to send emails:', emailError);
        }
      }

      // Send notification (async, non-blocking)
      try {
        const { data: warehouse } = await db
          .from('locations')
          .select('name')
          .eq('id', finalWarehouseId)
          .single();

        const { notificationService } = await import('@/features/notifications/services/notification.service');
        notificationService.notifyPickTicketCreated({
          pickTicketId: result.data.id,
          pickTicketNumber: result.data.pickTicketNumber,
          salesOrderNumber: salesOrder.order_number,
          warehouseName: warehouse?.name || 'Warehouse',
          createdBy: userId,
        }).catch((err) => {
          console.error('[createPickTicketFromSalesOrder] Failed to send notification:', err);
        });
      } catch (notifError) {
        console.error('[createPickTicketFromSalesOrder] Notification error:', notifError);
      }

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

  // Get sales order with customer info.
  // Note: the ship-to columns on sales_orders are named shipping_address_*
  // (migration 012). There is no ship_to_name — the recipient is the customer.
  const { data: salesOrder, error: soError } = await db
    .from('sales_orders')
    .select(`
      id,
      order_number,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      shipping_address_country,
      customer_po_number,
      requested_delivery_date,
      customers(id, name)
    `)
    .eq('id', pickTicket.salesOrderId)
    .single();

  if (soError || !salesOrder) {
    throw new Error(
      `Failed to load sales order ${pickTicket.salesOrderId} for shipment creation: ${soError?.message || 'not found'}`
    );
  }

  const customer = Array.isArray(salesOrder.customers)
    ? salesOrder.customers[0]
    : salesOrder.customers;

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
      ship_to_name: customer?.name || null,
      ship_to_address_street: salesOrder.shipping_address_street || null,
      ship_to_address_city: salesOrder.shipping_address_city || null,
      ship_to_address_state: salesOrder.shipping_address_state || null,
      ship_to_address_postal_code: salesOrder.shipping_address_postal_code || null,
      ship_to_address_country: salesOrder.shipping_address_country || null,
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


// ============================================
// PACKING LIST ACTIONS
// Note: Import packing list actions directly from './packing-list.actions'
// Re-exporting from a 'use server' file is not allowed in Next.js
// ============================================
