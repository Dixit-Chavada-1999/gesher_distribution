/**
 * PRODUCT MATCHER SERVICE
 * Matches and normalizes product SKUs
 * Creates products if they don't exist
 */

import { ProductMatchResult } from '../types';
import { IngestionRepository } from '../repositories/ingestion.repository';

export class ProductMatcherService {
  constructor(private repository: IngestionRepository) {}

  /**
   * Match product by SKU (with normalization)
   */
  async matchProduct(sku: string): Promise<ProductMatchResult> {
    const normalizedSKU = this.normalizeSKU(sku);

    const product = await this.repository.findProductBySKU(normalizedSKU);

    if (product) {
      return {
        matched: true,
        productId: product.id,
        sku: normalizedSKU,
        action: 'matched',
      };
    }

    return {
      matched: false,
      productId: null,
      sku: normalizedSKU,
      action: 'create_new',
    };
  }

  /**
   * Get or create commission service product
   */
  async getCommissionProduct(): Promise<ProductMatchResult> {
    const commissionSKU = 'COMMISSION-SERVICE';

    const product = await this.repository.findProductBySKU(commissionSKU);

    if (product) {
      return {
        matched: true,
        productId: product.id,
        sku: commissionSKU,
        action: 'matched',
      };
    }

    // Create commission service product
    const newProduct = await this.repository.createProduct({
      sku: commissionSKU,
      name: 'Sales Commission Service',
      description: 'Commission-only service item for Galileo invoicing',
      item_type: 'service',
      base_price: 27500, // $275 in cents
      base_cost: 0,
      status: 'active',
      category: 'Services',
    });

    return {
      matched: false,
      productId: newProduct.id,
      sku: commissionSKU,
      action: 'create_new',
    };
  }

  /**
   * Normalize SKU format
   * "290/85R38" → "290-85R38"
   * "380/85R24" → "380-85R24"
   */
  private normalizeSKU(sku: string): string {
    return sku
      .trim()
      .toUpperCase()
      .replace(/\//g, '-') // Replace / with -
      .replace(/\s+/g, '-'); // Replace spaces with -
  }

  /**
   * Get product details for 38" tire
   */
  get38TireDetails() {
    return {
      sku: '290-85R38',
      name: '290/85R38 Tire',
      description: '38" Agricultural Tire',
      item_type: 'inventory' as const,
      rim_size: '38',
      tire_size: '290/85R38',
      weight_lbs: 510,
      category: 'Tires',
      status: 'active' as const,
    };
  }

  /**
   * Get product details for 24" tire
   */
  get24TireDetails() {
    return {
      sku: '380-85R24',
      name: '380/85R24 Tire',
      description: '24" Agricultural Tire',
      item_type: 'inventory' as const,
      rim_size: '24',
      tire_size: '380/85R24',
      weight_lbs: 425,
      category: 'Tires',
      status: 'active' as const,
    };
  }
}
