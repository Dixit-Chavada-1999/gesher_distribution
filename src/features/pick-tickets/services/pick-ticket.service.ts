/**
 * Pick Ticket Service
 *
 * Business logic for warehouse pick ticket operations.
 */

import { PickTicketRepository } from '../repositories';
import type {
  PickTicket,
  PickTicketWithItems,
  PickTicketListItem,
  PickTicketListParams,
  CreatePickTicketDTO,
  UpdatePickTicketDTO,
  PickTicketStatus,
  PaginatedResult,
  PickItemDTO,
} from '../types';
import { PICK_TICKET_STATUS_TRANSITIONS } from '../types';

// ============================================
// SERVICE RESULT TYPE
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SERVICE
// ============================================

class PickTicketServiceImpl {
  /**
   * Get all pick tickets with pagination and filtering
   */
  async getPickTickets(
    params: PickTicketListParams = {}
  ): Promise<ServiceResult<PaginatedResult<PickTicketListItem>>> {
    try {
      const result = await PickTicketRepository.findMany(params);
      return { success: true, data: result };
    } catch (error) {
      console.error('[PickTicketService.getPickTickets] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pick tickets',
      };
    }
  }

  /**
   * Get a single pick ticket by ID
   */
  async getPickTicketById(id: string): Promise<ServiceResult<PickTicketWithItems>> {
    try {
      const pickTicket = await PickTicketRepository.findById(id);

      if (!pickTicket) {
        return { success: false, error: 'Pick ticket not found' };
      }

      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.getPickTicketById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pick ticket',
      };
    }
  }

  /**
   * Get pick tickets for a sales order
   */
  async getPickTicketsBySalesOrderId(salesOrderId: string): Promise<ServiceResult<PickTicket[]>> {
    try {
      const pickTickets = await PickTicketRepository.findBySalesOrderId(salesOrderId);
      return { success: true, data: pickTickets };
    } catch (error) {
      console.error('[PickTicketService.getPickTicketsBySalesOrderId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch pick tickets',
      };
    }
  }

  /**
   * Create a new pick ticket
   */
  async createPickTicket(
    dto: CreatePickTicketDTO,
    userId?: string
  ): Promise<ServiceResult<PickTicket>> {
    try {
      // Validate items
      if (!dto.items || dto.items.length === 0) {
        return { success: false, error: 'At least one item is required' };
      }

      // Validate quantities
      for (const item of dto.items) {
        if (item.quantityToPick <= 0) {
          return { success: false, error: `Invalid quantity for SKU ${item.sku}` };
        }
      }

      const pickTicket = await PickTicketRepository.create(dto, userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.createPickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pick ticket',
      };
    }
  }

  /**
   * Update a pick ticket
   */
  async updatePickTicket(
    id: string,
    dto: UpdatePickTicketDTO,
    userId?: string
  ): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Only block editing cancelled pick tickets
      if (existing.status === 'cancelled') {
        return {
          success: false,
          error: 'Cannot edit cancelled pick ticket',
        };
      }

      // Update items if provided
      if (dto.items && dto.items.length > 0) {
        console.log('[PickTicketService.updatePickTicket] Updating items:', dto.items);
        await PickTicketRepository.updateItems(dto.items, userId);
      } else {
        console.log('[PickTicketService.updatePickTicket] No items to update');
      }

      const pickTicket = await PickTicketRepository.update(id, dto, userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.updatePickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pick ticket',
      };
    }
  }

  /**
   * Assign a pick ticket to a user
   */
  async assignPickTicket(
    id: string,
    assignedTo: string,
    userId?: string
  ): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Can only assign pending pick tickets
      if (existing.status !== 'pending') {
        return {
          success: false,
          error: `Cannot assign pick ticket in ${existing.status} status`,
        };
      }

      const pickTicket = await PickTicketRepository.assign(id, assignedTo, userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.assignPickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign pick ticket',
      };
    }
  }

  /**
   * Start picking (transition to picking status)
   */
  async startPicking(id: string, userId?: string): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Validate status transition
      if (existing.status !== 'assigned') {
        return {
          success: false,
          error: `Cannot start picking from ${existing.status} status. Must be assigned first.`,
        };
      }

      const pickTicket = await PickTicketRepository.updateStatus(id, 'picking', userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.startPicking] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start picking',
      };
    }
  }

  /**
   * Pick an item (mark quantity as picked)
   */
  async pickItem(
    pickTicketId: string,
    item: PickItemDTO,
    userId?: string
  ): Promise<ServiceResult<PickTicketWithItems>> {
    try {
      const existing = await PickTicketRepository.findById(pickTicketId);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Must be in picking status
      if (existing.status !== 'picking') {
        return {
          success: false,
          error: `Cannot pick items. Pick ticket is in ${existing.status} status.`,
        };
      }

      // Find the item
      const pickTicketItem = existing.items.find((i) => i.id === item.pickTicketItemId);
      if (!pickTicketItem) {
        return { success: false, error: 'Pick ticket item not found' };
      }

      // Validate quantity
      if (item.quantityPicked < 0 || item.quantityPicked > pickTicketItem.quantityToPick) {
        return {
          success: false,
          error: `Invalid quantity. Must be between 0 and ${pickTicketItem.quantityToPick}`,
        };
      }

      // Update the item
      await PickTicketRepository.updateItem(item.pickTicketItemId, item.quantityPicked, userId);

      // Check if all items are picked
      const allPicked = await PickTicketRepository.areAllItemsPicked(pickTicketId);
      if (allPicked) {
        // Auto-transition to picked status
        await PickTicketRepository.updateStatus(pickTicketId, 'picked', userId);
      }

      // Return updated pick ticket
      const updated = await PickTicketRepository.findById(pickTicketId);
      return { success: true, data: updated! };
    } catch (error) {
      console.error('[PickTicketService.pickItem] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick item',
      };
    }
  }

  /**
   * Pick multiple items at once
   */
  async pickItems(
    pickTicketId: string,
    items: PickItemDTO[],
    userId?: string
  ): Promise<ServiceResult<PickTicketWithItems>> {
    try {
      for (const item of items) {
        const result = await this.pickItem(pickTicketId, item, userId);
        if (!result.success) {
          return result;
        }
      }

      const updated = await PickTicketRepository.findById(pickTicketId);
      return { success: true, data: updated! };
    } catch (error) {
      console.error('[PickTicketService.pickItems] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick items',
      };
    }
  }

  /**
   * Complete picking (transition to picked/shipped status and create shipment)
   * Allowed from 'picking' or 'picked' status
   */
  async completePicking(id: string, userId?: string): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Must be in picking or picked status (before packing list is created)
      if (!['picking', 'picked'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot complete picking from ${existing.status} status`,
        };
      }

      // Check if all items are picked
      const allPicked = await PickTicketRepository.areAllItemsPicked(id);
      if (!allPicked) {
        return {
          success: false,
          error: 'Not all items have been picked. Please pick all items before completing.',
        };
      }

      // Transition to 'shipped' status (shipment will be created by action)
      const pickTicket = await PickTicketRepository.updateStatus(id, 'shipped', userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.completePicking] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete picking',
      };
    }
  }

  /**
   * Transition status with validation
   */
  async transitionStatus(
    id: string,
    newStatus: PickTicketStatus,
    userId?: string
  ): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Validate status transition
      const allowedTransitions = PICK_TICKET_STATUS_TRANSITIONS[existing.status];
      if (!allowedTransitions.includes(newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const pickTicket = await PickTicketRepository.updateStatus(id, newStatus, userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.transitionStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      };
    }
  }

  /**
   * Cancel a pick ticket
   */
  async cancelPickTicket(id: string, userId?: string): Promise<ServiceResult<PickTicket>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Can only cancel if not shipped
      if (['shipped'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot cancel pick ticket in ${existing.status} status`,
        };
      }

      const pickTicket = await PickTicketRepository.updateStatus(id, 'cancelled', userId);
      return { success: true, data: pickTicket };
    } catch (error) {
      console.error('[PickTicketService.cancelPickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel pick ticket',
      };
    }
  }

  /**
   * Delete a pick ticket (soft delete)
   */
  async deletePickTicket(id: string, userId?: string): Promise<ServiceResult<void>> {
    try {
      const existing = await PickTicketRepository.findById(id);

      if (!existing) {
        return { success: false, error: 'Pick ticket not found' };
      }

      // Can only delete pending or cancelled pick tickets
      if (!['pending', 'cancelled'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot delete pick ticket in ${existing.status} status`,
        };
      }

      await PickTicketRepository.delete(id, userId);
      return { success: true };
    } catch (error) {
      console.error('[PickTicketService.deletePickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pick ticket',
      };
    }
  }
}

// Export singleton instance
export const PickTicketService = new PickTicketServiceImpl();
