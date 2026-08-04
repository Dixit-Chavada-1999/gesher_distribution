/**
 * QBO Product Sync Service
 *
 * Handles syncing products between our system and QuickBooks Online.
 * Creates/updates items in QBO when products are created/updated in our system.
 */

import { qboSyncRepository, getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import type { Product } from '@/features/products/types';
import type { QboSyncResult, QboEntitySync } from '@/modules/integrations/core/types/qbo-sync.types';
import type { AccountingProduct } from '@/modules/integrations/core';

// ============================================
// TYPES
// ============================================

interface SyncProductResult {
  success: boolean;
  qboItemId?: string;
  syncRecord?: QboEntitySync;
  error?: string;
}

interface ProductSyncData {
  product: Product;
  userId?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map our Product to QBO AccountingProduct format
 */
function mapProductToQboFormat(product: Product): AccountingProduct {
  return {
    name: product.name,
    sku: product.sku,
    description: product.description || undefined,
    unitPrice: product.basePrice, // Already in cents, will be converted in provider
    // Tires are physical products, not services
    type: 'non_inventory', // Using non_inventory as we don't track inventory in QBO
    active: product.status === 'active',
    metadata: {
      gesherProductId: product.id,
      gesherSku: product.sku,
      category: product.category,
      baseCost: product.baseCost,
    },
  };
}

/**
 * Get the active QBO connection and realm ID
 */
async function getQboConnection(): Promise<{
  connectionId: string;
  realmId: string;
} | null> {
  const connection = await getConnectionByProvider('quickbooks');

  if (!connection || connection.status !== 'connected') {
    return null;
  }

  if (!connection.external_account_id) {
    return null;
  }

  return {
    connectionId: connection.id,
    realmId: connection.external_account_id,
  };
}

// ============================================
// SYNC SERVICE
// ============================================

export const qboProductSyncService = {
  /**
   * Sync a single product to QuickBooks
   * Called when a product is created or updated
   */
  async syncProduct(data: ProductSyncData): Promise<SyncProductResult> {
    const { product, userId } = data;

    try {
      // Get QBO connection
      const qboConnection = await getQboConnection();

      if (!qboConnection) {
        // No QBO connection - cannot sync
        console.log('No QBO connection available, skipping product sync');
        return {
          success: false,
          error: 'QuickBooks not connected',
        };
      }

      const { connectionId, realmId } = qboConnection;

      // Check if product already has a sync record
      const existingSync = await qboSyncRepository.findByEntity(
        'product',
        product.id,
        realmId
      );

      if (existingSync?.syncStatus === 'synced' && existingSync.qboEntityId) {
        // Product already synced - update in QBO
        return await this.updateProductInQbo(
          product,
          existingSync,
          connectionId,
          userId
        );
      }

      // Create or get pending sync record
      const syncRecord = existingSync || await qboSyncRepository.create(
        {
          entityType: 'product',
          entityId: product.id,
          qboRealmId: realmId,
          syncStatus: 'pending',
          syncDirection: 'push',
        },
        userId
      );

      // Create product in QBO
      return await this.createProductInQbo(
        product,
        syncRecord,
        connectionId,
        userId
      );
    } catch (error) {
      console.error('QboProductSyncService.syncProduct error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Create a new product/item in QuickBooks
   */
  async createProductInQbo(
    product: Product,
    syncRecord: QboEntitySync,
    connectionId: string,
    userId?: string
  ): Promise<SyncProductResult> {
    try {
      // Map product to QBO format
      const qboProduct = mapProductToQboFormat(product);

      // Create in QBO
      const result = await quickBooksProvider.createProduct(
        connectionId,
        qboProduct
      );

      if (!result.externalId) {
        throw new Error('QBO did not return an item ID');
      }

      // Mark sync as successful
      const updatedSync = await qboSyncRepository.markSynced(
        syncRecord.id,
        result.externalId,
        userId
      );

      console.log(
        `Product ${product.sku} synced to QBO with ID ${result.externalId}`
      );

      return {
        success: true,
        qboItemId: result.externalId,
        syncRecord: updatedSync,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create product in QBO:', errorMessage);

      // Mark sync as failed
      await qboSyncRepository.markFailed(syncRecord.id, errorMessage, userId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Update an existing product/item in QuickBooks
   */
  async updateProductInQbo(
    product: Product,
    syncRecord: QboEntitySync,
    connectionId: string,
    userId?: string
  ): Promise<SyncProductResult> {
    try {
      if (!syncRecord.qboEntityId) {
        throw new Error('No QBO item ID found');
      }

      // Map product to QBO format
      const qboProduct = mapProductToQboFormat(product);

      // Update in QBO
      const result = await quickBooksProvider.updateProduct(
        connectionId,
        syncRecord.qboEntityId,
        qboProduct
      );

      // Update sync timestamp
      const updatedSync = await qboSyncRepository.update(
        syncRecord.id,
        {
          lastSyncedAt: new Date(),
          lastError: null,
        },
        userId
      );

      console.log(
        `Product ${product.sku} updated in QBO (ID: ${syncRecord.qboEntityId})`
      );

      return {
        success: true,
        qboItemId: result.externalId || syncRecord.qboEntityId,
        syncRecord: updatedSync,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update product in QBO:', errorMessage);

      // Update sync record with error
      await qboSyncRepository.update(
        syncRecord.id,
        {
          lastError: errorMessage,
        },
        userId
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Queue a product for sync (creates pending record)
   */
  async queueProductForSync(
    productId: string,
    realmId: string,
    userId?: string
  ): Promise<QboEntitySync> {
    return await qboSyncRepository.upsert(
      {
        entityType: 'product',
        entityId: productId,
        qboRealmId: realmId,
        syncStatus: 'pending',
        syncDirection: 'push',
      },
      userId
    );
  },

  /**
   * Process pending product syncs
   * Called by background job
   */
  async processPendingSyncs(limit: number = 50): Promise<QboSyncResult[]> {
    const results: QboSyncResult[] = [];

    // Get QBO connection
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      console.log('No QBO connection, skipping pending sync processing');
      return results;
    }

    // Get pending syncs
    const pendingSyncs = await qboSyncRepository.getPendingSyncs(
      'product',
      qboConnection.realmId,
      limit
    );

    console.log(`Processing ${pendingSyncs.length} pending product syncs`);

    for (const pendingSync of pendingSyncs) {
      try {
        // Get product data
        const { productRepository } = await import('@/features/products/repositories');
        const product = await productRepository.findById(pendingSync.entityId);

        if (!product) {
          // Product was deleted, remove sync record
          await qboSyncRepository.remove(pendingSync.id);
          results.push({
            success: false,
            entityType: 'product',
            entityId: pendingSync.entityId,
            error: 'Product not found',
          });
          continue;
        }

        // Get full sync record
        const syncRecord = await qboSyncRepository.findById(pendingSync.id);
        if (!syncRecord) {
          continue;
        }

        // Sync product
        const result = await this.createProductInQbo(
          product,
          syncRecord,
          qboConnection.connectionId
        );

        results.push({
          success: result.success,
          entityType: 'product',
          entityId: product.id,
          qboEntityId: result.qboItemId,
          error: result.error,
        });
      } catch (error) {
        results.push({
          success: false,
          entityType: 'product',
          entityId: pendingSync.entityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },

  /**
   * Retry failed product syncs
   * Called by background job
   */
  async retryFailedSyncs(limit: number = 50): Promise<QboSyncResult[]> {
    const results: QboSyncResult[] = [];

    // Get QBO connection
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return results;
    }

    // Get failed syncs ready for retry
    const failedSyncs = await qboSyncRepository.getFailedSyncsForRetry(
      qboConnection.realmId,
      limit
    );

    // Filter to only product syncs
    const productSyncs = failedSyncs.filter(s => s.entityType === 'product');

    console.log(`Retrying ${productSyncs.length} failed product syncs`);

    for (const failedSync of productSyncs) {
      // Reset to pending and process
      await qboSyncRepository.resetToPending(failedSync.id);
    }

    // Process the reset pending syncs
    return await this.processPendingSyncs(limit);
  },

  /**
   * Get sync status for a product
   */
  async getSyncStatus(
    productId: string,
    realmId?: string
  ): Promise<QboEntitySync | null> {
    if (!realmId) {
      const qboConnection = await getQboConnection();
      if (!qboConnection) {
        return null;
      }
      realmId = qboConnection.realmId;
    }

    return await qboSyncRepository.findByEntity('product', productId, realmId);
  },

  /**
   * Get QBO item ID for a synced product
   */
  async getQboItemId(productId: string): Promise<string | null> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return null;
    }

    return await qboSyncRepository.getQboEntityId(
      'product',
      productId,
      qboConnection.realmId
    );
  },

  /**
   * Check if product is synced to QBO
   */
  async isProductSynced(productId: string): Promise<boolean> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return false;
    }

    return await qboSyncRepository.isSynced(
      'product',
      productId,
      qboConnection.realmId
    );
  },
};

export type QboProductSyncService = typeof qboProductSyncService;
