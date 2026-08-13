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
export async function fetchOperationsData(): Promise<ActionResult<OperationsData>> {
  try {
    const data = await getOperationsData();
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching operations data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch operations data',
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
export async function fetchSupplierSchedule(): Promise<ActionResult<ShipmentScheduleItem[]>> {
  try {
    const data = await getSupplierSchedule();
    return { success: true, data };
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
export async function fetchGDC1Inventory(): Promise<ActionResult<GDC1InventoryItem[]>> {
  try {
    const data = await getWarehouseInventory();
    return { success: true, data };
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
    const data = await getRimItems();
    return { success: true, data };
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
export async function refreshOperationsData(): Promise<ActionResult<OperationsData>> {
  return fetchOperationsData();
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
      'SOLD': 'sold',
      'OPEN': 'open',
      'HOLD': 'hold',
      'IN_TRANSIT': 'in_transit',
      'INVOICED': 'invoiced',
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
