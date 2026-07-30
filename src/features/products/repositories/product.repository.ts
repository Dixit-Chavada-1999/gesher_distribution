/**
 * Products Repository
 *
 * Data access layer for Products module.
 * Handles all database operations for products using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type { Product, CreateProductDTO, UpdateProductDTO, ProductListParams, ProductStatus } from '../types';

// ============================================
// DATABASE ROW TYPE
// ============================================

interface DbProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  rim_size: string | null;
  tire_size: string | null;
  weight_lbs: string | null;
  base_cost: number;
  base_price: number;
  status: ProductStatus;
  is_sellable: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

// ============================================
// TYPES
// ============================================

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// REPOSITORY
// ============================================

class ProductRepositoryImpl {
  /**
   * Find all products with pagination and filtering
   */
  async findMany(params: ProductListParams = {}): Promise<PaginatedResult<Product>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      isSellable,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('products')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.or(
        `sku.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply category filter
    if (category) {
      query = query.eq('category', category);
    }

    // Apply sellable filter
    if (isSellable !== undefined) {
      query = query.eq('is_sellable', isSellable);
    }

    // Map camelCase sort fields to snake_case
    const sortFieldMap: Record<string, string> = {
      shortDescription: 'short_description',
      rimSize: 'rim_size',
      tireSize: 'tire_size',
      weightLbs: 'weight_lbs',
      baseCost: 'base_cost',
      basePrice: 'base_price',
      isSellable: 'is_sellable',
      imageUrl: 'image_url',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToProduct(row as DbProduct)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single product by ID
   */
  async findById(id: string): Promise<Product | null> {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch product: ${error.message}`);
    }

    return data ? this.mapToProduct(data as DbProduct) : null;
  }

  /**
   * Find a single product by SKU
   */
  async findBySku(sku: string): Promise<Product | null> {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('sku', sku)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch product: ${error.message}`);
    }

    return data ? this.mapToProduct(data as DbProduct) : null;
  }

  /**
   * Check if SKU exists (for validation)
   */
  async skuExists(sku: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('sku', sku)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check SKU: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Create a new product
   */
  async create(data: CreateProductDTO, userId?: string): Promise<Product> {
    const { data: result, error } = await db
      .from('products')
      .insert({
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        short_description: data.shortDescription ?? null,
        category: data.category ?? null,
        rim_size: data.rimSize ?? null,
        tire_size: data.tireSize ?? null,
        weight_lbs: data.weightLbs?.toString() ?? null,
        base_cost: data.baseCost,
        base_price: data.basePrice,
        status: data.status || 'active',
        is_sellable: data.isSellable ?? true,
        image_url: data.imageUrl ?? null,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }

    return this.mapToProduct(result as DbProduct);
  }

  /**
   * Update an existing product
   */
  async update(id: string, data: UpdateProductDTO, userId?: string): Promise<Product> {
    const updateData: Record<string, unknown> = {
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shortDescription !== undefined) updateData.short_description = data.shortDescription;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.rimSize !== undefined) updateData.rim_size = data.rimSize;
    if (data.tireSize !== undefined) updateData.tire_size = data.tireSize;
    if (data.weightLbs !== undefined) updateData.weight_lbs = data.weightLbs?.toString() ?? null;
    if (data.baseCost !== undefined) updateData.base_cost = data.baseCost;
    if (data.basePrice !== undefined) updateData.base_price = data.basePrice;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isSellable !== undefined) updateData.is_sellable = data.isSellable;
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

    const { data: result, error } = await db
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }

    return this.mapToProduct(result as DbProduct);
  }

  /**
   * Soft delete a product
   */
  async softDelete(id: string, userId?: string): Promise<Product> {
    const { data, error } = await db
      .from('products')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }

    return this.mapToProduct(data as DbProduct);
  }

  /**
   * Restore a soft-deleted product
   */
  async restore(id: string, userId?: string): Promise<Product> {
    const { data, error } = await db
      .from('products')
      .update({
        deleted_at: null,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to restore product: ${error.message}`);
    }

    return this.mapToProduct(data as DbProduct);
  }

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await db
      .from('products')
      .select('category')
      .is('deleted_at', null)
      .not('category', 'is', null)
      .order('category', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`);
    }

    // Get unique categories
    const categories = [...new Set((data || []).filter((r) => r.category).map((r) => r.category as string))];
    return categories;
  }

  /**
   * Get product counts by status
   */
  async getCountsByStatus(): Promise<Record<ProductStatus, number>> {
    const { data, error } = await db
      .from('products')
      .select('status')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get product counts: ${error.message}`);
    }

    const counts: Record<ProductStatus, number> = {
      active: 0,
      inactive: 0,
      discontinued: 0,
    };

    (data || []).forEach((r) => {
      const prodStatus = r.status as ProductStatus;
      counts[prodStatus] = (counts[prodStatus] || 0) + 1;
    });

    return counts;
  }

  /**
   * Map database row to Product type
   */
  private mapToProduct(data: DbProduct): Product {
    return {
      id: data.id,
      sku: data.sku,
      name: data.name,
      description: data.description,
      shortDescription: data.short_description,
      category: data.category,
      rimSize: data.rim_size,
      tireSize: data.tire_size,
      weightLbs: data.weight_lbs ? Number(data.weight_lbs) : null,
      baseCost: data.base_cost,
      basePrice: data.base_price,
      status: data.status,
      isSellable: data.is_sellable,
      imageUrl: data.image_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }
}

export const productRepository = new ProductRepositoryImpl();
export type ProductRepository = typeof productRepository;
