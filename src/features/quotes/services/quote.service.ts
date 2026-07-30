/**
 * Quotes Service
 *
 * Business logic layer for Quotes module.
 * Handles validation, business rules, and orchestration.
 */

import { quoteRepository } from '../repositories/quote.repository';
import {
  createQuoteSchema,
  updateQuoteSchema,
  formToCreateDTO,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteFormInput,
} from '../lib/schemas';
import type {
  Quote,
  QuoteWithItems,
  QuoteListItem,
  QuoteListParams,
  QuoteStatus,
  CreateQuoteItemDTO,
} from '../types';
import { QUOTE_STATUS_TRANSITIONS as STATUS_TRANSITIONS } from '../types';

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

/**
 * Validate status transition
 */
function isValidStatusTransition(currentStatus: QuoteStatus, newStatus: QuoteStatus): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const quoteService = {
  /**
   * Get paginated list of quotes
   */
  async list(params: QuoteListParams = {}): Promise<PaginatedServiceResult<QuoteListItem>> {
    try {
      const result = await quoteRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('QuoteService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch quotes',
      };
    }
  },

  /**
   * Get a single quote by ID
   */
  async getById(id: string): Promise<ServiceResult<QuoteWithItems>> {
    try {
      const quote = await quoteRepository.findById(id);

      if (!quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch quote',
      };
    }
  },

  /**
   * Get a single quote by quote number
   */
  async getByQuoteNumber(quoteNumber: string): Promise<ServiceResult<QuoteWithItems>> {
    try {
      const quote = await quoteRepository.findByQuoteNumber(quoteNumber);

      if (!quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.getByQuoteNumber error:', error);
      return {
        success: false,
        error: 'Failed to fetch quote',
      };
    }
  },

  /**
   * Create a new quote from form data
   */
  async createFromForm(
    input: QuoteFormInput,
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Convert form data to DTO
      const dto = formToCreateDTO(input);

      // Validate with schema
      const validation = createQuoteSchema.safeParse(dto);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Create quote
      const quote = await quoteRepository.create(validation.data, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.createFromForm error:', error);
      return {
        success: false,
        error: 'Failed to create quote',
      };
    }
  },

  /**
   * Create a new quote from DTO
   */
  async create(
    input: CreateQuoteInput,
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Validate input
      const validation = createQuoteSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Create quote
      const quote = await quoteRepository.create(validation.data, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.create error:', error);
      return {
        success: false,
        error: 'Failed to create quote',
      };
    }
  },

  /**
   * Update an existing quote
   */
  async update(
    id: string,
    input: UpdateQuoteInput,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if quote can be edited (only draft and sent)
      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit quote in ${existing.status} status`,
        };
      }

      // Validate input
      const validation = updateQuoteSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Update quote
      const quote = await quoteRepository.update(id, validation.data, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.update error:', error);
      return {
        success: false,
        error: 'Failed to update quote',
      };
    }
  },

  /**
   * Update quote items
   */
  async updateItems(
    id: string,
    items: CreateQuoteItemDTO[],
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if quote can be edited
      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit items for quote in ${existing.status} status`,
        };
      }

      // Validate items
      if (items.length === 0) {
        return {
          success: false,
          error: 'At least one item is required',
        };
      }

      // Replace items
      await quoteRepository.replaceItems(id, items, userId);

      // Return updated quote
      const quote = await quoteRepository.findById(id);

      return {
        success: true,
        data: quote!,
      };
    } catch (error) {
      console.error('QuoteService.updateItems error:', error);
      return {
        success: false,
        error: 'Failed to update quote items',
      };
    }
  },

  /**
   * Soft delete a quote
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Only allow deletion of draft quotes
      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft quotes can be deleted',
        };
      }

      const quote = await quoteRepository.softDelete(id, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete quote',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send quote (draft -> sent)
   */
  async send(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    return this.transitionStatus(id, 'sent', userId);
  },

  /**
   * Accept quote (sent -> accepted)
   */
  async accept(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    return this.transitionStatus(id, 'accepted', userId);
  },

  /**
   * Reject quote (sent -> rejected)
   */
  async reject(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    return this.transitionStatus(id, 'rejected', userId);
  },

  /**
   * Mark quote as expired (sent -> expired)
   */
  async expire(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    return this.transitionStatus(id, 'expired', userId);
  },

  /**
   * Convert quote to sales order (accepted -> converted)
   * This also creates the sales order
   */
  async convertToSalesOrder(
    id: string,
    userId?: string
  ): Promise<ServiceResult<{ quote: Quote; salesOrderId: string }>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, 'converted')) {
        return {
          success: false,
          error: `Cannot convert quote in ${existing.status} status. Quote must be accepted first.`,
        };
      }

      // Import sales order service dynamically to avoid circular dependencies
      const { salesOrderService } = await import('@/features/sales-orders/services');

      // Create sales order from quote data
      const salesOrderResult = await salesOrderService.create(
        {
          orderDate: new Date(),
          requestedDeliveryDate: null,
          customerId: existing.customerId,
          salesRepId: existing.salesRepId,
          currencyCode: existing.currencyCode,
          status: 'draft',
          billingAddress: {
            street: existing.billingAddressStreet,
            city: existing.billingAddressCity,
            state: existing.billingAddressState,
            postalCode: existing.billingAddressPostalCode,
            country: existing.billingAddressCountry,
          },
          shippingAddress: {
            street: existing.shippingAddressStreet,
            city: existing.shippingAddressCity,
            state: existing.shippingAddressState,
            postalCode: existing.shippingAddressPostalCode,
            country: existing.shippingAddressCountry,
          },
          items: existing.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unitCode: item.unitCode,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxRate: item.taxRate,
          })),
          customerNotes: existing.customerNotes,
          internalNotes: existing.internalNotes,
        },
        userId
      );

      if (!salesOrderResult.success || !salesOrderResult.data) {
        return {
          success: false,
          error: salesOrderResult.error || 'Failed to create sales order',
        };
      }

      // Mark quote as converted
      const quote = await quoteRepository.markAsConverted(
        id,
        salesOrderResult.data.id,
        userId
      );

      // Update the sales order with quote reference
      const { db } = await import('@/shared/lib/supabase/database');
      await db
        .from('sales_orders')
        .update({ quote_id: id })
        .eq('id', salesOrderResult.data.id);

      return {
        success: true,
        data: {
          quote,
          salesOrderId: salesOrderResult.data.id,
        },
      };
    } catch (error) {
      console.error('QuoteService.convertToSalesOrder error:', error);
      return {
        success: false,
        error: 'Failed to convert quote to sales order',
      };
    }
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: QuoteStatus,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const quote = await quoteRepository.updateStatus(id, newStatus, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update quote status',
      };
    }
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get quote counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<QuoteStatus, number>>> {
    try {
      const counts = await quoteRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('QuoteService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Get next quote number
   */
  async getNextQuoteNumber(): Promise<ServiceResult<string>> {
    try {
      const quoteNumber = await quoteRepository.getNextQuoteNumber();
      return {
        success: true,
        data: quoteNumber,
      };
    } catch (error) {
      console.error('QuoteService.getNextQuoteNumber error:', error);
      return {
        success: false,
        error: 'Failed to generate quote number',
      };
    }
  },
};

export type QuoteService = typeof quoteService;
