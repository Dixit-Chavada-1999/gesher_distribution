/**
 * Products Service
 *
 * Business logic layer for Products module.
 * Handles validation, business rules, and orchestration.
 */

import { productRepository } from '../repositories/product.repository';
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '../lib/schemas';
import type { Product, ProductListParams, ProductWithFormattedPrices, ProductTableRow } from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price from cents to display string
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Calculate margin and margin percentage
 */
function calculateMargin(cost: number, price: number): { margin: number; marginPercent: number } {
  const margin = price - cost;
  const marginPercent = cost > 0 ? ((price - cost) / cost) * 100 : 0;
  return { margin, marginPercent: Math.round(marginPercent * 100) / 100 };
}

/**
 * Add formatted prices to product
 */
function withFormattedPrices(product: Product): ProductWithFormattedPrices {
  const { margin, marginPercent } = calculateMargin(product.baseCost, product.basePrice);
  return {
    ...product,
    formattedBaseCost: formatPrice(product.baseCost),
    formattedBasePrice: formatPrice(product.basePrice),
    margin,
    marginPercent,
  };
}

/**
 * Convert product to table row format
 */
function toTableRow(product: Product): ProductTableRow {
  const { margin, marginPercent } = calculateMargin(product.baseCost, product.basePrice);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    baseCost: product.baseCost,
    basePrice: product.basePrice,
    formattedBaseCost: formatPrice(product.baseCost),
    formattedBasePrice: formatPrice(product.basePrice),
    margin,
    marginPercent,
    status: product.status,
    isSellable: product.isSellable,
    createdAt: product.createdAt,
  };
}

// ============================================
// SERVICE
// ============================================

export const productService = {
  /**
   * Get paginated list of products
   */
  async list(params: ProductListParams = {}): Promise<ServiceResult<{
    data: ProductTableRow[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>> {
    try {
      const result = await productRepository.findMany(params);

      return {
        success: true,
        data: {
          data: result.data.map(toTableRow),
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('ProductService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
      };
    }
  },

  /**
   * Get a single product by ID
   */
  async getById(id: string): Promise<ServiceResult<ProductWithFormattedPrices>> {
    try {
      const product = await productRepository.findById(id);

      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return {
        success: true,
        data: withFormattedPrices(product),
      };
    } catch (error) {
      console.error('ProductService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch product',
      };
    }
  },

  /**
   * Get a single product by SKU
   */
  async getBySku(sku: string): Promise<ServiceResult<ProductWithFormattedPrices>> {
    try {
      const product = await productRepository.findBySku(sku);

      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return {
        success: true,
        data: withFormattedPrices(product),
      };
    } catch (error) {
      console.error('ProductService.getBySku error:', error);
      return {
        success: false,
        error: 'Failed to fetch product',
      };
    }
  },

  /**
   * Create a new product
   */
  async create(input: CreateProductInput, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Validate input
      const validation = createProductSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if SKU already exists
      const skuExists = await productRepository.skuExists(data.sku);
      if (skuExists) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: ['A product with this SKU already exists'] },
        };
      }

      // Validate business rules
      if (data.basePrice < data.baseCost) {
        return {
          success: false,
          error: 'Price cannot be less than cost',
          errors: { basePrice: ['Price must be greater than or equal to cost'] },
        };
      }

      // Create product
      const product = await productRepository.create(data, userId);

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      console.error('ProductService.create error:', error);
      return {
        success: false,
        error: 'Failed to create product',
      };
    }
  },

  /**
   * Update an existing product
   */
  async update(id: string, input: UpdateProductInput, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Check if product exists
      const existing = await productRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      // Validate input
      const validation = updateProductSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if SKU already exists (if changing)
      if (data.sku && data.sku !== existing.sku) {
        const skuExists = await productRepository.skuExists(data.sku, id);
        if (skuExists) {
          return {
            success: false,
            error: 'SKU already exists',
            errors: { sku: ['A product with this SKU already exists'] },
          };
        }
      }

      // Validate business rules
      const newCost = data.baseCost ?? existing.baseCost;
      const newPrice = data.basePrice ?? existing.basePrice;
      if (newPrice < newCost) {
        return {
          success: false,
          error: 'Price cannot be less than cost',
          errors: { basePrice: ['Price must be greater than or equal to cost'] },
        };
      }

      // Update product
      const product = await productRepository.update(id, data, userId);

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      console.error('ProductService.update error:', error);
      return {
        success: false,
        error: 'Failed to update product',
      };
    }
  },

  /**
   * Soft delete a product
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Check if product exists
      const existing = await productRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      // TODO: Check if product is used in any orders (future phase)
      // For now, just soft delete

      const product = await productRepository.softDelete(id, userId);

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      console.error('ProductService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete product',
      };
    }
  },

  /**
   * Restore a soft-deleted product
   */
  async restore(id: string, userId?: string): Promise<ServiceResult<Product>> {
    try {
      const product = await productRepository.restore(id, userId);

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      console.error('ProductService.restore error:', error);
      return {
        success: false,
        error: 'Failed to restore product',
      };
    }
  },

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<ServiceResult<string[]>> {
    try {
      const categories = await productRepository.getCategories();
      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      console.error('ProductService.getCategories error:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
      };
    }
  },

  /**
   * Get product counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<string, number>>> {
    try {
      const counts = await productRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('ProductService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Validate SKU uniqueness
   */
  async validateSku(sku: string, excludeId?: string): Promise<ServiceResult<boolean>> {
    try {
      const exists = await productRepository.skuExists(sku, excludeId);
      return {
        success: true,
        data: !exists,
      };
    } catch (error) {
      console.error('ProductService.validateSku error:', error);
      return {
        success: false,
        error: 'Failed to validate SKU',
      };
    }
  },
};

export type ProductService = typeof productService;
