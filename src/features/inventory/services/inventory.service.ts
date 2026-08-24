/**
 * Inventory Service
 *
 * Business logic layer for Inventory module.
 */

import { inventoryRepository } from '../repositories/inventory.repository';
import type {
  Inventory,
  InventoryWithDetails,
  InventoryListItem,
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
} from '../types';

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
// SERVICE
// ============================================

export const inventoryService = {
  /**
   * Get paginated list of inventory records
   */
  async list(params: InventoryListParams = {}): Promise<PaginatedServiceResult<InventoryListItem>> {
    try {
      const result = await inventoryRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('InventoryService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Get a single inventory record by ID
   */
  async getById(id: string): Promise<ServiceResult<InventoryWithDetails>> {
    try {
      const inventory = await inventoryRepository.findById(id);

      if (!inventory) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Get inventory for multiple products across all locations
   */
  async getByProductIds(productIds: string[]): Promise<ServiceResult<InventoryListItem[]>> {
    try {
      const inventory = await inventoryRepository.findByProductIds(productIds);
      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getByProductIds error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory for products',
      };
    }
  },

  /**
   * Get inventory by product and location
   */
  async getByProductAndLocation(
    productId: string,
    locationId: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(
        productId,
        locationId
      );

      if (!inventory) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getByProductAndLocation error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Create a new inventory record
   */
  async create(
    data: CreateInventoryDTO,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      // Check if inventory already exists for this product/location combo
      const existing = await inventoryRepository.findByProductAndLocation(
        data.productId,
        data.locationId
      );

      if (existing) {
        return {
          success: false,
          error: 'Inventory record already exists for this product and location',
        };
      }

      // Validate allocated <= onHand
      const onHand = data.onHand ?? 0;
      const allocated = data.allocated ?? 0;
      if (allocated > onHand) {
        return {
          success: false,
          error: 'Allocated quantity cannot exceed on-hand quantity',
        };
      }

      const inventory = await inventoryRepository.create(data, userId);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.create error:', error);
      return {
        success: false,
        error: 'Failed to create inventory',
      };
    }
  },

  /**
   * Update an existing inventory record
   */
  async update(
    id: string,
    data: UpdateInventoryDTO,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      const existing = await inventoryRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      // Calculate new values
      const newOnHand = data.onHand ?? existing.onHand;
      const newAllocated = data.allocated ?? existing.allocated;

      // Validate allocated <= onHand
      if (newAllocated > newOnHand) {
        return {
          success: false,
          error: 'Allocated quantity cannot exceed on-hand quantity',
        };
      }

      const inventory = await inventoryRepository.update(id, data, userId);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.update error:', error);
      return {
        success: false,
        error: 'Failed to update inventory',
      };
    }
  },

  /**
   * Adjust on-hand quantity
   */
  async adjust(
    id: string,
    adjustment: number,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.adjustOnHand(id, adjustment, userId);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.adjust error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust inventory',
      };
    }
  },

  /**
   * Allocate inventory (reserve for sales order)
   */
  async allocate(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Allocation quantity must be positive',
        };
      }

      const inventory = await inventoryRepository.allocate(id, quantity, userId, reference);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.allocate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate inventory',
      };
    }
  },

  /**
   * Allocate inventory by product and location
   */
  async allocateByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.allocate(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.allocateByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate inventory',
      };
    }
  },

  /**
   * Deallocate inventory
   */
  async deallocate(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Deallocation quantity must be positive',
        };
      }

      const inventory = await inventoryRepository.deallocate(id, quantity, userId, reference);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.deallocate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deallocate inventory',
      };
    }
  },

  /**
   * Deallocate inventory by product and location
   */
  async deallocateByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.deallocate(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.deallocateByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deallocate inventory',
      };
    }
  },

  /**
   * Ship inventory (reduce on_hand and allocated when pick ticket completes)
   */
  async ship(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Ship quantity must be positive',
        };
      }

      const inventory = await inventoryRepository.ship(id, quantity, userId, reference);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.ship error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ship inventory',
      };
    }
  },

  /**
   * Ship inventory by product and location
   */
  async shipByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.ship(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.shipByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ship inventory',
      };
    }
  },

  /**
   * Receive inventory (increase on_hand when shipment arrives)
   */
  async receive(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Receive quantity must be positive',
        };
      }

      const inventory = await inventoryRepository.receive(id, quantity, userId, reference);

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.receive error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to receive inventory',
      };
    }
  },

  /**
   * Receive inventory by product and location (or create if doesn't exist)
   */
  async receiveByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      let inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);

      // Create inventory record if doesn't exist
      if (!inventory) {
        inventory = await inventoryRepository.create({
          productId,
          locationId,
          onHand: 0,
          allocated: 0,
          reorderPoint: 0,
          reorderQty: 0,
        }, userId);
      }

      return this.receive(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.receiveByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to receive inventory',
      };
    }
  },

  /**
   * Delete an inventory record
   */
  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      const existing = await inventoryRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      // Don't allow deletion if there's allocated inventory
      if (existing.allocated > 0) {
        return {
          success: false,
          error: 'Cannot delete inventory with allocated quantity',
        };
      }

      await inventoryRepository.delete(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('InventoryService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete inventory',
      };
    }
  },

  /**
   * Get low stock items
   */
  async getLowStockItems(): Promise<ServiceResult<InventoryListItem[]>> {
    try {
      const items = await inventoryRepository.getLowStockItems();

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      console.error('InventoryService.getLowStockItems error:', error);
      return {
        success: false,
        error: 'Failed to fetch low stock items',
      };
    }
  },
};

export type InventoryService = typeof inventoryService;
