'use server';

/**
 * Operations Dashboard Server Actions
 *
 * Server-side actions for Jenny's operations dashboard.
 * These are called from client components.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser } from '@/shared/lib/auth';
import {
  getOperationsData,
  getStats,
  getAttentionItems,
  getSupplierSchedule,
  getWarehouseInventory,
  getRimItems,
  getExportData,
  getFilterOptionsData,
  type ExportOptions,
} from '../services';
import type {
  OperationsData,
  OperationsStats,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  RimInstallationItem,
  ShipmentStatus,
  SKUColumnInfo,
  OperationsFilters,
  FilterOptions,
} from '../types';

// ============================================
// RESULT TYPE
// ============================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// FETCH ALL DASHBOARD DATA
// ============================================

/**
 * Fetch all operations dashboard data
 */
export async function fetchOperationsData(filters?: OperationsFilters): Promise<ActionResult<OperationsData>> {
  try {
    const data = await getOperationsData(filters);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching operations data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch operations data',
    };
  }
}

/**
 * Fetch filter options for dropdowns
 */
export async function fetchFilterOptions(): Promise<ActionResult<FilterOptions>> {
  try {
    const data = await getFilterOptionsData();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch filter options',
    };
  }
}

// ============================================
// FETCH INDIVIDUAL SECTIONS
// ============================================

/**
 * Fetch just the KPI stats
 */
export async function fetchOperationsStats(): Promise<ActionResult<OperationsStats>> {
  try {
    const data = await getStats();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    };
  }
}

/**
 * Fetch immediate attention items
 */
export async function fetchImmediateAttention(): Promise<ActionResult<ImmediateAttentionItem[]>> {
  try {
    const data = await getAttentionItems();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching attention items:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attention items',
    };
  }
}

/**
 * Fetch supplier shipment schedule
 */
export async function fetchSupplierSchedule(): Promise<ActionResult<{ data: ShipmentScheduleItem[]; uniqueSkus: SKUColumnInfo[] }>> {
  try {
    const result = await getSupplierSchedule();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching supplier schedule:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch supplier schedule',
    };
  }
}

/**
 * Fetch GDC1 inventory
 */
export async function fetchGDC1Inventory(): Promise<ActionResult<{ data: GDC1InventoryItem[]; uniqueSkus: SKUColumnInfo[] }>> {
  try {
    const result = await getWarehouseInventory();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching GDC1 inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch GDC1 inventory',
    };
  }
}

/**
 * Fetch rim installation items
 */
export async function fetchRimInstallation(): Promise<ActionResult<RimInstallationItem[]>> {
  try {
    const result = await getRimItems();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error fetching rim installation items:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rim installation items',
    };
  }
}

// ============================================
// REFRESH DATA
// ============================================

/**
 * Refresh all dashboard data (called by refresh button)
 */
export async function refreshOperationsData(filters?: OperationsFilters): Promise<ActionResult<OperationsData>> {
  return fetchOperationsData(filters);
}

// ============================================
// EXPORT DATA
// ============================================

/**
 * Get data for Excel export
 */
export async function fetchExportData(
  options?: ExportOptions
): Promise<ActionResult<Partial<OperationsData>>> {
  try {
    const data = await getExportData(options);
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching export data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch export data',
    };
  }
}

// ============================================
// UPDATE SHIPMENT STATUS (Jenny's manual update)
// ============================================

export interface UpdateShipmentStatusInput {
  shipmentId: string;
  loadStatus?: ShipmentStatus;
  actionRequired?: string;
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  notes?: string;
}

/**
 * Update shipment status and notes
 * Used by Jenny to manually update load status
 */
export async function updateShipmentStatus(
  input: UpdateShipmentStatusInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Map ShipmentStatus to database load_status
    const loadStatusMap: Record<ShipmentStatus, string> = {
      'AVAILABLE': 'available',
      'OPEN': 'open',
      'HOLD': 'hold',
      'IN_TRANSIT': 'in_transit',
      'SOLD': 'sold',
      'CLOSED': 'closed',
      'INVOICED': 'invoiced',
      'NOT_INVOICED': 'not_invoiced',
      'PARTIALLY_PAID': 'partially_paid',
      'PAID': 'paid',
      'DISPUTED': 'disputed',
      'PO_NEEDED': 'po_needed',
      'DELIVERED': 'delivered',
    };

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (input.loadStatus) {
      updateData.load_status = loadStatusMap[input.loadStatus] || input.loadStatus.toLowerCase();

      // Also update main status for certain load statuses
      if (input.loadStatus === 'IN_TRANSIT') {
        updateData.status = 'in_transit';
      } else if (input.loadStatus === 'DELIVERED') {
        updateData.status = 'delivered';
      }
    }

    if (input.actionRequired !== undefined) {
      updateData.action_required = input.actionRequired;
    }

    if (input.confirmedEta !== undefined) {
      updateData.confirmed_eta = input.confirmedEta;
    }

    if (input.actualDeliveryDate !== undefined) {
      updateData.actual_arrival = input.actualDeliveryDate;
    }

    if (input.qtyDelivered !== undefined) {
      updateData.qty_delivered = input.qtyDelivered;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const { error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', input.shipmentId);

    if (error) {
      console.error('Error updating shipment:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: input.shipmentId } };
  } catch (error) {
    console.error('Error updating shipment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update shipment',
    };
  }
}

/**
 * Bulk update shipment statuses
 * Useful for batch operations
 */
export async function bulkUpdateShipmentStatus(
  updates: UpdateShipmentStatusInput[]
): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    let updatedCount = 0;

    for (const input of updates) {
      const result = await updateShipmentStatus(input);
      if (result.success) {
        updatedCount++;
      }
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { updated: updatedCount } };
  } catch (error) {
    console.error('Error bulk updating shipments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk update shipments',
    };
  }
}

// ============================================
// GET SHIPMENT FOR EDIT
// ============================================

export interface ShipmentEditData {
  id: string;
  shipmentNumber: string;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPoNumber: string | null;
  loadStatus: string | null;
  totalQty: number;
  etaToPort: string | null;
  customerExpectedDelivery: string | null;
  actionRequired: string | null;
  notes: string | null;
}

/**
 * Get shipment data for editing
 */
export async function getShipmentForEdit(
  shipmentId: string
): Promise<ActionResult<ShipmentEditData>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await db
      .from('shipments')
      .select(`
        id,
        shipment_number,
        sales_order_id,
        load_status,
        total_qty,
        eta_to_port,
        customer_expected_delivery,
        action_required,
        notes,
        sales_orders(
          id,
          order_number,
          customer_po_number,
          customer_id,
          customers(
            id,
            name
          )
        )
      `)
      .eq('id', shipmentId)
      .single();

    if (error) {
      console.error('Error fetching shipment:', error);
      return { success: false, error: error.message };
    }

    // Extract nested data
    const salesOrder = Array.isArray(data.sales_orders)
      ? data.sales_orders[0]
      : data.sales_orders;
    const customer = salesOrder?.customers
      ? (Array.isArray(salesOrder.customers) ? salesOrder.customers[0] : salesOrder.customers)
      : null;

    return {
      success: true,
      data: {
        id: data.id,
        shipmentNumber: data.shipment_number,
        salesOrderId: data.sales_order_id,
        salesOrderNumber: salesOrder?.order_number || null,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        customerPoNumber: salesOrder?.customer_po_number || null,
        loadStatus: data.load_status,
        totalQty: data.total_qty || 0,
        etaToPort: data.eta_to_port,
        customerExpectedDelivery: data.customer_expected_delivery,
        actionRequired: data.action_required,
        notes: data.notes,
      },
    };
  } catch (error) {
    console.error('Error fetching shipment for edit:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch shipment',
    };
  }
}

// ============================================
// GET SALES ORDERS FOR DROPDOWN
// ============================================

export interface SalesOrderOption {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPoNumber: string | null;
}

/**
 * Get sales orders for dropdown selection
 */
export async function getSalesOrdersForDropdown(): Promise<ActionResult<SalesOrderOption[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_po_number,
        customers(
          id,
          name
        )
      `)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching sales orders:', error);
      return { success: false, error: error.message };
    }

    const options: SalesOrderOption[] = (data || []).map((so) => {
      const customer = Array.isArray(so.customers) ? so.customers[0] : so.customers;
      return {
        id: so.id,
        orderNumber: so.order_number,
        customerName: customer?.name || 'Unknown',
        customerPoNumber: so.customer_po_number,
      };
    });

    return { success: true, data: options };
  } catch (error) {
    console.error('Error fetching sales orders for dropdown:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sales orders',
    };
  }
}

// ============================================
// UPDATE SHIPMENT (Full Edit)
// ============================================

export interface UpdateShipmentInput {
  shipmentId: string;
  salesOrderId?: string | null;
  loadStatus?: string;
  etaToPort?: string | null;
  customerExpectedDelivery?: string | null;
  actionRequired?: string | null;
  notes?: string | null;
}

/**
 * Update shipment with sales order link and other fields
 */
export async function updateShipment(
  input: UpdateShipmentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    if (input.salesOrderId !== undefined) {
      updateData.sales_order_id = input.salesOrderId || null;
    }

    if (input.loadStatus !== undefined) {
      updateData.load_status = input.loadStatus;

      // Also update main status for certain load statuses
      if (input.loadStatus === 'in_transit') {
        updateData.status = 'in_transit';
      } else if (input.loadStatus === 'delivered') {
        updateData.status = 'delivered';
      }
    }

    if (input.etaToPort !== undefined) {
      updateData.eta_to_port = input.etaToPort || null;
    }

    if (input.customerExpectedDelivery !== undefined) {
      updateData.customer_expected_delivery = input.customerExpectedDelivery || null;
    }

    if (input.actionRequired !== undefined) {
      updateData.action_required = input.actionRequired || null;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes || null;
    }

    const { error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', input.shipmentId);

    if (error) {
      console.error('Error updating shipment:', error);
      return { success: false, error: error.message };
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: input.shipmentId } };
  } catch (error) {
    console.error('Error updating shipment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update shipment',
    };
  }
}

// ============================================
// UPDATE SHIPMENT OR ORDER (Smart Update)
// ============================================

export interface UpdateShipmentOrOrderInput {
  id: string;
  status: ShipmentStatus;
  etaToPort?: string | null;
  customerExpectedDelivery?: string | null;
  actionRequired?: string | null;
}

/**
 * Smart update that tries shipments first, then sales_orders
 * Used by the simplified edit dialog
 */
export async function updateShipmentOrOrder(
  input: UpdateShipmentOrOrderInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Map ShipmentStatus to database values (based on Jenny's Master Sheet)
    const statusMap: Record<ShipmentStatus, { loadStatus: string; soStatus: string }> = {
      // Common statuses
      'AVAILABLE': { loadStatus: 'available', soStatus: 'pending' },
      'OPEN': { loadStatus: 'open', soStatus: 'pending' },
      'IN_TRANSIT': { loadStatus: 'in_transit', soStatus: 'shipped' },
      'SOLD': { loadStatus: 'sold', soStatus: 'confirmed' },
      'HOLD': { loadStatus: 'hold', soStatus: 'pending' },
      'CLOSED': { loadStatus: 'closed', soStatus: 'cancelled' },
      // Invoice/Payment statuses
      'INVOICED': { loadStatus: 'invoiced', soStatus: 'delivered' },
      'NOT_INVOICED': { loadStatus: 'not_invoiced', soStatus: 'confirmed' },
      'PARTIALLY_PAID': { loadStatus: 'partially_paid', soStatus: 'delivered' },
      'PAID': { loadStatus: 'paid', soStatus: 'delivered' },
      'DISPUTED': { loadStatus: 'disputed', soStatus: 'pending' },
      // Other statuses
      'PO_NEEDED': { loadStatus: 'po_needed', soStatus: 'draft' },
      'DELIVERED': { loadStatus: 'delivered', soStatus: 'delivered' },
    };

    const mapped = statusMap[input.status] || { loadStatus: 'open', soStatus: 'pending' };

    // Try to update shipment first
    const { data: shipment } = await db
      .from('shipments')
      .select('id')
      .eq('id', input.id)
      .single();

    if (shipment) {
      // Update shipment
      const updateData: Record<string, unknown> = {
        load_status: mapped.loadStatus,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (input.etaToPort !== undefined) {
        updateData.eta_to_port = input.etaToPort || null;
      }
      if (input.customerExpectedDelivery !== undefined) {
        updateData.customer_expected_delivery = input.customerExpectedDelivery || null;
      }
      if (input.actionRequired !== undefined) {
        updateData.action_required = input.actionRequired || null;
      }

      const { error } = await db
        .from('shipments')
        .update(updateData)
        .eq('id', input.id);

      if (error) {
        console.error('Error updating shipment:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Try sales_orders
      const { data: salesOrder } = await db
        .from('sales_orders')
        .select('id')
        .eq('id', input.id)
        .single();

      if (salesOrder) {
        // Update sales order
        const updateData: Record<string, unknown> = {
          status: mapped.soStatus,
          updated_at: new Date().toISOString(),
        };

        if (input.customerExpectedDelivery !== undefined) {
          updateData.requested_delivery_date = input.customerExpectedDelivery || null;
        }
        if (input.actionRequired !== undefined) {
          updateData.internal_notes = input.actionRequired || null;
        }

        const { error } = await db
          .from('sales_orders')
          .update(updateData)
          .eq('id', input.id);

        if (error) {
          console.error('Error updating sales order:', error);
          return { success: false, error: error.message };
        }
      } else {
        return { success: false, error: 'Record not found' };
      }
    }

    // Revalidate operations dashboard
    revalidatePath('/operations');

    return { success: true, data: { id: input.id } };
  } catch (error) {
    console.error('Error updating record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update record',
    };
  }
}
