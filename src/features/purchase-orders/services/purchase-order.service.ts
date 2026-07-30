/**
 * Purchase Orders Service
 *
 * Business logic layer for Purchase Orders module.
 */

import { purchaseOrderRepository } from '../repositories/purchase-order.repository';
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
   */
  async confirm(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'confirmed', userId);
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
