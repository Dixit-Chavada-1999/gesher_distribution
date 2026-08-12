/**
 * Invoices Service
 *
 * Business logic layer for Invoices module.
 */

import { invoiceRepository } from '../repositories/invoice.repository';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type RecordPaymentInput,
} from '../lib/schemas';
import type {
  Invoice,
  InvoiceWithItems,
  InvoiceListItem,
  InvoiceListParams,
  InvoiceStatus,
  InvoicePayment,
} from '../types';
import { INVOICE_STATUS_TRANSITIONS } from '../types';
import { creditCheckService } from '@/features/customers/services/credit-check.service';

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

function isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
  const allowedTransitions = INVOICE_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const invoiceService = {
  /**
   * Get paginated list of invoices
   */
  async list(params: InvoiceListParams = {}): Promise<PaginatedServiceResult<InvoiceListItem>> {
    try {
      const result = await invoiceRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('InvoiceService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch invoices',
      };
    }
  },

  /**
   * Get a single invoice by ID
   */
  async getById(id: string): Promise<ServiceResult<InvoiceWithItems>> {
    try {
      const invoice = await invoiceRepository.findById(id);

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch invoice',
      };
    }
  },

  /**
   * Create a new invoice
   */
  async create(
    input: CreateInvoiceInput,
    userId?: string
  ): Promise<ServiceResult<InvoiceWithItems>> {
    try {
      const validation = createInvoiceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const invoice = await invoiceRepository.create(validation.data, userId);

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.create error:', error);
      return {
        success: false,
        error: 'Failed to create invoice',
      };
    }
  },

  /**
   * Update an existing invoice
   */
  async update(
    id: string,
    input: UpdateInvoiceInput,
    userId?: string
  ): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit invoice in ${existing.status} status`,
        };
      }

      const validation = updateInvoiceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const invoice = await invoiceRepository.update(id, validation.data, userId);

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.update error:', error);
      return {
        success: false,
        error: 'Failed to update invoice',
      };
    }
  },

  /**
   * Soft delete an invoice
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft invoices can be deleted',
        };
      }

      const invoice = await invoiceRepository.softDelete(id, userId);

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete invoice',
      };
    }
  },

  /**
   * Record a payment
   * Also updates the customer's open balance
   */
  async recordPayment(
    id: string,
    input: RecordPaymentInput,
    userId?: string
  ): Promise<ServiceResult<InvoicePayment>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (['draft', 'cancelled', 'paid'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot record payment for invoice in ${existing.status} status`,
        };
      }

      const validation = recordPaymentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check if payment amount is valid
      if (validation.data.amount > existing.balanceDue) {
        return {
          success: false,
          error: `Payment amount exceeds balance due (${existing.balanceDue / 100})`,
        };
      }

      const payment = await invoiceRepository.recordPayment(id, validation.data, userId);

      // Subtract payment amount from customer's open balance
      await creditCheckService.subtractFromBalance(
        existing.customerId,
        validation.data.amount,
        userId
      );

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      console.error('InvoiceService.recordPayment error:', error);
      return {
        success: false,
        error: 'Failed to record payment',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send invoice (draft -> sent)
   * Also updates the customer's open balance
   */
  async send(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      // Get the invoice first to update customer balance
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: `Cannot send invoice in ${existing.status} status`,
        };
      }

      // Transition the status
      const result = await this.transitionStatus(id, 'sent', userId);

      if (result.success && result.data) {
        // Add invoice amount to customer's open balance
        await creditCheckService.addToBalance(
          existing.customerId,
          existing.grandTotal,
          userId
        );
      }

      return result;
    } catch (error) {
      console.error('InvoiceService.send error:', error);
      return {
        success: false,
        error: 'Failed to send invoice',
      };
    }
  },

  /**
   * Mark as overdue (sent/partial -> overdue)
   */
  async markOverdue(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    return this.transitionStatus(id, 'overdue', userId);
  },

  /**
   * Cancel invoice
   * Reverses the customer's open balance if invoice was sent
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      // If invoice was sent (not draft), we need to reverse the balance addition
      const wasAddedToBalance = existing.status !== 'draft';

      const result = await this.transitionStatus(id, 'cancelled', userId);

      if (result.success && result.data && wasAddedToBalance) {
        // Subtract the remaining balance from customer's open balance
        // (grandTotal - amountPaid = what was never paid and should be removed)
        const amountToReverse = existing.grandTotal - existing.amountPaid;
        if (amountToReverse > 0) {
          await creditCheckService.subtractFromBalance(
            existing.customerId,
            amountToReverse,
            userId
          );
        }
      }

      return result;
    } catch (error) {
      console.error('InvoiceService.cancel error:', error);
      return {
        success: false,
        error: 'Failed to cancel invoice',
      };
    }
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: InvoiceStatus,
    userId?: string
  ): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const invoice = await invoiceRepository.updateStatus(id, newStatus, userId);

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update invoice status',
      };
    }
  },
};

export type InvoiceService = typeof invoiceService;
