/**
 * Inventory Repository
 *
 * Data access layer for Inventory module.
 * Per client doc: "per product per location: on_hand, allocated. Derived available = on_hand - allocated"
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Inventory,
  InventoryWithDetails,
  InventoryListItem,
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
  PaginatedResult,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbInventory {
  id: string;
  product_id: string;
  location_id: string;
  on_hand: number;
  allocated: number;
  reorder_point: number;
  reorder_qty: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class InventoryRepositoryImpl {
  /**
   * Find all inventory records with pagination and filtering
   */
  async findMany(params: InventoryListParams = {}): Promise<PaginatedResult<InventoryListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      productId,
      locationId,
      lowStockOnly,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('inventory')
      .select(
        `
        id,
        product_id,
        location_id,
        on_hand,
        allocated,
        reorder_point,
        reorder_qty,
        created_at,
        updated_at,
        products!inner (
          id,
          sku,
          name,
          unit_code
        ),
        locations!inner (
          id,
          code,
          name
        )
      `,
        { count: 'exact' }
      );

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (search) {
      // Search by product SKU or name
      query = query.or(`products.sku.ilike.%${search}%,products.name.ilike.%${search}%`);
    }

    const sortFieldMap: Record<string, string> = {
      onHand: 'on_hand',
      allocated: 'allocated',
      reorderPoint: 'reorder_point',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'updated_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // Filter low stock after fetch if needed (can't do computed column filter in query)
    let results = (data || []).map((row) => this.mapToListItem(row));

    if (lowStockOnly) {
      results = results.filter((item) => item.isLowStock);
    }

    return {
      data: results,
      meta: {
        total: lowStockOnly ? results.length : total,
        page,
        limit,
        totalPages: lowStockOnly ? Math.ceil(results.length / limit) : totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single inventory record by ID with details
   */
  async findById(id: string): Promise<InventoryWithDetails | null> {
    const { data, error } = await db
      .from('inventory')
      .select(
        `
        *,
        products (
          id,
          sku,
          name,
          unit_code
        ),
        locations (
          id,
          code,
          name
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToInventoryWithDetails(data);
  }

  /**
   * Find inventory by product and location
   */
  async findByProductAndLocation(
    productId: string,
    locationId: string
  ): Promise<Inventory | null> {
    const { data, error } = await db
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .eq('location_id', locationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }

    if (!data) {return null;}

    return this.mapToInventory(data as DbInventory);
  }

  /**
   * Create a new inventory record
   */
  async create(data: CreateInventoryDTO, userId?: string): Promise<Inventory> {
    const { data: result, error } = await db
      .from('inventory')
      .insert({
        product_id: data.productId,
        location_id: data.locationId,
        on_hand: data.onHand ?? 0,
        allocated: data.allocated ?? 0,
        reorder_point: data.reorderPoint ?? 0,
        reorder_qty: data.reorderQty ?? 0,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create inventory: ${error.message}`);
    }

    return this.mapToInventory(result as DbInventory);
  }

  /**
   * Update an existing inventory record
   */
  async update(id: string, data: UpdateInventoryDTO, userId?: string): Promise<Inventory> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.onHand !== undefined) {updateData.on_hand = data.onHand;}
    if (data.allocated !== undefined) {updateData.allocated = data.allocated;}
    if (data.reorderPoint !== undefined) {updateData.reorder_point = data.reorderPoint;}
    if (data.reorderQty !== undefined) {updateData.reorder_qty = data.reorderQty;}

    const { data: result, error } = await db
      .from('inventory')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update inventory: ${error.message}`);
    }

    return this.mapToInventory(result as DbInventory);
  }

  /**
   * Adjust inventory on_hand quantity
   */
  async adjustOnHand(
    id: string,
    adjustment: number,
    userId?: string
  ): Promise<Inventory> {
    // First get current value
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Inventory record not found');
    }

    const newOnHand = current.onHand + adjustment;
    if (newOnHand < 0) {
      throw new Error('Cannot reduce on_hand below 0');
    }

    if (newOnHand < current.allocated) {
      throw new Error('Cannot reduce on_hand below allocated quantity');
    }

    return this.update(id, { onHand: newOnHand }, userId);
  }

  /**
   * Allocate inventory
   */
  async allocate(
    id: string,
    quantity: number,
    userId?: string
  ): Promise<Inventory> {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Inventory record not found');
    }

    const newAllocated = current.allocated + quantity;
    if (newAllocated > current.onHand) {
      throw new Error('Cannot allocate more than on_hand quantity');
    }

    return this.update(id, { allocated: newAllocated }, userId);
  }

  /**
   * Deallocate inventory
   */
  async deallocate(
    id: string,
    quantity: number,
    userId?: string
  ): Promise<Inventory> {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Inventory record not found');
    }

    const newAllocated = current.allocated - quantity;
    if (newAllocated < 0) {
      throw new Error('Cannot deallocate more than currently allocated');
    }

    return this.update(id, { allocated: newAllocated }, userId);
  }

  /**
   * Delete an inventory record
   */
  async delete(id: string): Promise<void> {
    const { error } = await db
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete inventory: ${error.message}`);
    }
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(): Promise<InventoryListItem[]> {
    const { data, error } = await db
      .from('inventory')
      .select(
        `
        id,
        product_id,
        location_id,
        on_hand,
        allocated,
        reorder_point,
        reorder_qty,
        created_at,
        updated_at,
        products!inner (
          id,
          sku,
          name,
          unit_code
        ),
        locations!inner (
          id,
          code,
          name
        )
      `
      );

    if (error) {
      throw new Error(`Failed to fetch low stock items: ${error.message}`);
    }

    // Filter to low stock items (available <= reorder_point)
    return (data || [])
      .map((row) => this.mapToListItem(row))
      .filter((item) => item.isLowStock);
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToInventory(data: DbInventory): Inventory {
    return {
      id: data.id,
      productId: data.product_id,
      locationId: data.location_id,
      onHand: data.on_hand,
      allocated: data.allocated,
      reorderPoint: data.reorder_point,
      reorderQty: data.reorder_qty,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToInventoryWithDetails(data: {
    id: string;
    product_id: string;
    location_id: string;
    on_hand: number;
    allocated: number;
    reorder_point: number;
    reorder_qty: number;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    updated_by: string | null;
    products: { id: string; sku: string; name: string; unit_code: string } | null;
    locations: { id: string; code: string; name: string } | null;
  }): InventoryWithDetails {
    const available = data.on_hand - data.allocated;
    const isLowStock = available <= data.reorder_point;

    return {
      id: data.id,
      productId: data.product_id,
      locationId: data.location_id,
      onHand: data.on_hand,
      allocated: data.allocated,
      available,
      reorderPoint: data.reorder_point,
      reorderQty: data.reorder_qty,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      isLowStock,
      product: data.products
        ? {
            id: data.products.id,
            sku: data.products.sku,
            name: data.products.name,
            unitCode: data.products.unit_code,
          }
        : undefined,
      location: data.locations
        ? {
            id: data.locations.id,
            code: data.locations.code,
            name: data.locations.name,
          }
        : undefined,
    };
  }

  private mapToListItem(data: {
    id: string;
    product_id: string;
    location_id: string;
    on_hand: number;
    allocated: number;
    reorder_point: number;
    reorder_qty: number;
    created_at: string;
    updated_at: string;
    products: { id: string; sku: string; name: string; unit_code: string } | { id: string; sku: string; name: string; unit_code: string }[];
    locations: { id: string; code: string; name: string } | { id: string; code: string; name: string }[];
  }): InventoryListItem {
    const product = Array.isArray(data.products) ? data.products[0] : data.products;
    const location = Array.isArray(data.locations) ? data.locations[0] : data.locations;
    const available = data.on_hand - data.allocated;
    const isLowStock = available <= data.reorder_point;

    return {
      id: data.id,
      productId: data.product_id,
      productSku: product?.sku || 'Unknown',
      productName: product?.name || 'Unknown',
      locationId: data.location_id,
      locationCode: location?.code || 'Unknown',
      locationName: location?.name || 'Unknown',
      onHand: data.on_hand,
      allocated: data.allocated,
      available,
      reorderPoint: data.reorder_point,
      reorderQty: data.reorder_qty,
      isLowStock,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const inventoryRepository = new InventoryRepositoryImpl();
export type InventoryRepository = typeof inventoryRepository;
