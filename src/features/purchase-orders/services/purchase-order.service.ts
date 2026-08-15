/**
 * Purchase Orders Service
 *
 * Business logic layer for Purchase Orders module.
 */

import { purchaseOrderRepository } from '../repositories/purchase-order.repository';
import { createClient } from '@/shared/lib/supabase/server';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type CreatePOInput,
  type UpdatePOInput,
} from '../lib/schemas';
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  POListItem,
  POListParams,
  POStatus,
} from '../types';
import { PO_STATUS_TRANSITIONS } from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

interface PaginatedServiceResult<T> {
  success: boolean;
  data?: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  error?: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isValidStatusTransition(currentStatus: POStatus, newStatus: POStatus): boolean {
  const allowedTransitions = PO_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const purchaseOrderService = {
  /**
   * Get paginated list of purchase orders
   */
  async list(params: POListParams = {}): Promise<PaginatedServiceResult<POListItem>> {
    try {
      const result = await purchaseOrderRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('PurchaseOrderService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
      };
    }
  },

  /**
   * Get a single PO by ID
   */
  async getById(id: string): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const po = await purchaseOrderRepository.findById(id);

      if (!po) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase order',
      };
    }
  },

  /**
   * Create a new PO
   */
  async create(
    input: CreatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const validation = createPurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const po = await purchaseOrderRepository.create(validation.data, userId);

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.create error:', error);
      return {
        success: false,
        error: 'Failed to create purchase order',
      };
    }
  },

  /**
   * Update an existing PO
   */
  async update(
    id: string,
    input: UpdatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      const validation = updatePurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const po = await purchaseOrderRepository.update(id, validation.data, userId);

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.update error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order',
      };
    }
  },

  /**
   * Soft delete a PO
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft purchase orders can be deleted',
        };
      }

      const po = await purchaseOrderRepository.softDelete(id, userId);

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete purchase order',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send PO (draft -> sent)
   */
  async send(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'sent', userId);
  },

  /**
   * Confirm PO (sent -> confirmed)
   * Also auto-creates a shipment with source='supplier' for Supplier Schedule
   */
  async confirm(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.transitionStatus(id, 'confirmed', userId);

    // If PO confirmed successfully, auto-create shipment with source='supplier'
    if (result.success && result.data) {
      try {
        await this.createSupplierShipment(id, userId);
      } catch (error) {
        console.error('Failed to auto-create supplier shipment:', error);
        // Don't fail the PO confirmation if shipment creation fails
      }
    }

    return result;
  },

  /**
   * Auto-create shipment from PO for Supplier Schedule (source='supplier')
   */
  async createSupplierShipment(poId: string, userId?: string): Promise<void> {
    const supabase = await createClient();

    // Get PO with items
    const po = await purchaseOrderRepository.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Generate shipment number
    const { data: shipmentNumber, error: numError } = await supabase.rpc('generate_shipment_number');
    if (numError) {
      throw new Error(`Failed to generate shipment number: ${numError.message}`);
    }

    // Calculate total quantity
    const totalQty = po.items.reduce((sum, item) => sum + item.quantityOrdered, 0);

    // Create shipment with source='supplier'
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        shipment_date: new Date().toISOString().split('T')[0],
        estimated_arrival: po.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        sales_order_id: po.salesOrderId || null,
        purchase_order_id: po.id,
        source: 'supplier',
        load_status: 'open',
        total_qty: totalQty,
        outstanding_qty: totalQty,
        ship_to_address_street: po.shipToAddressStreet,
        ship_to_address_city: po.shipToAddressCity,
        ship_to_address_state: po.shipToAddressState,
        ship_to_address_postal_code: po.shipToAddressPostalCode,
        ship_to_address_country: po.shipToAddressCountry,
        status: 'pending',
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (shipmentError) {
      throw new Error(`Failed to create shipment: ${shipmentError.message}`);
    }

    // Create shipment items
    const shipmentItems = po.items.map((item, index) => ({
      shipment_id: shipment.id,
      product_id: item.productId,
      purchase_order_item_id: item.id,
      sku: item.sku,
      description: item.description,
      quantity_shipped: item.quantityOrdered,
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await supabase
      .from('shipment_items')
      .insert(shipmentItems);

    if (itemsError) {
      // Clean up shipment if items insertion fails
      await supabase.from('shipments').delete().eq('id', shipment.id);
      throw new Error(`Failed to create shipment items: ${itemsError.message}`);
    }

    console.log(`[PO Confirm] Auto-created shipment ${shipmentNumber} with source='supplier' for PO ${po.poNumber}`);
  },

  /**
   * Mark as partially received (confirmed -> partial)
   */
  async markPartial(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'partial', userId);
  },

  /**
   * Mark as fully received (confirmed/partial -> received)
   */
  async markReceived(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'received', userId);
  },

  /**
   * Cancel PO
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'cancelled', userId);
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: POStatus,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const po = await purchaseOrderRepository.updateStatus(id, newStatus, userId);

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order status',
      };
    }
  },
};

export type PurchaseOrderService = typeof purchaseOrderService;
