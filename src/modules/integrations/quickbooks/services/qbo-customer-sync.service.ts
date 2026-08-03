/**
 * QBO Customer Sync Service
 *
 * Handles syncing customers between our system and QuickBooks Online.
 * Creates/updates customers in QBO when they are created/updated in our system.
 */

import { qboSyncRepository, getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import type { Customer } from '@/features/customers/types';
import type { QboSyncResult, QboEntitySync } from '@/modules/integrations/core/types/qbo-sync.types';
import type { AccountingCustomer } from '@/modules/integrations/core';

// ============================================
// TYPES
// ============================================

interface SyncCustomerResult {
  success: boolean;
  qboCustomerId?: string;
  syncRecord?: QboEntitySync;
  error?: string;
}

interface CustomerSyncData {
  customer: Customer;
  userId?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map our Customer to QBO AccountingCustomer format
 */
function mapCustomerToQboFormat(customer: Customer): AccountingCustomer {
  return {
    displayName: customer.name,
    companyName: customer.legalName || customer.name,
    email: customer.email || undefined,
    phone: customer.phone || undefined,
    billingAddress: customer.address1
      ? {
          line1: customer.address1,
          line2: customer.address2 || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          postalCode: customer.zip || undefined,
          country: customer.country || undefined,
        }
      : undefined,
    shippingAddress: customer.useSeparateShipping && customer.shippingAddress1
      ? {
          line1: customer.shippingAddress1,
          line2: customer.shippingAddress2 || undefined,
          city: customer.shippingCity || undefined,
          state: customer.shippingState || undefined,
          postalCode: customer.shippingZip || undefined,
          country: customer.shippingCountry || undefined,
        }
      : undefined,
    taxExempt: customer.taxExempt,
    // Store our customer code in QBO notes for reference
    metadata: {
      gesherCustomerCode: customer.customerCode,
      gesherCustomerId: customer.id,
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

export const qboCustomerSyncService = {
  /**
   * Sync a single customer to QuickBooks
   * Called when a customer is created or updated
   */
  async syncCustomer(data: CustomerSyncData): Promise<SyncCustomerResult> {
    const { customer, userId } = data;

    try {
      // Get QBO connection
      const qboConnection = await getQboConnection();

      if (!qboConnection) {
        // No QBO connection - create pending sync record for later
        console.log('No QBO connection available, queueing sync for later');

        // We can't create a sync record without a realm ID
        // This will be handled when QBO is connected
        return {
          success: false,
          error: 'QuickBooks not connected',
        };
      }

      const { connectionId, realmId } = qboConnection;

      // Check if customer already has a sync record
      const existingSync = await qboSyncRepository.findByEntity(
        'customer',
        customer.id,
        realmId
      );

      if (existingSync?.syncStatus === 'synced' && existingSync.qboEntityId) {
        // Customer already synced - update in QBO
        return await this.updateCustomerInQbo(
          customer,
          existingSync,
          connectionId,
          userId
        );
      }

      // Create or get pending sync record
      const syncRecord = existingSync || await qboSyncRepository.create(
        {
          entityType: 'customer',
          entityId: customer.id,
          qboRealmId: realmId,
          syncStatus: 'pending',
          syncDirection: 'push',
        },
        userId
      );

      // Create customer in QBO
      return await this.createCustomerInQbo(
        customer,
        syncRecord,
        connectionId,
        userId
      );
    } catch (error) {
      console.error('QboCustomerSyncService.syncCustomer error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Create a new customer in QuickBooks
   */
  async createCustomerInQbo(
    customer: Customer,
    syncRecord: QboEntitySync,
    connectionId: string,
    userId?: string
  ): Promise<SyncCustomerResult> {
    try {
      // Map customer to QBO format
      const qboCustomer = mapCustomerToQboFormat(customer);

      // Create in QBO
      const result = await quickBooksProvider.createCustomer(
        connectionId,
        qboCustomer
      );

      if (!result.externalId) {
        throw new Error('QBO did not return a customer ID');
      }

      // Mark sync as successful
      const updatedSync = await qboSyncRepository.markSynced(
        syncRecord.id,
        result.externalId,
        userId
      );

      console.log(
        `Customer ${customer.customerCode} synced to QBO with ID ${result.externalId}`
      );

      return {
        success: true,
        qboCustomerId: result.externalId,
        syncRecord: updatedSync,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create customer in QBO:', errorMessage);

      // Mark sync as failed
      await qboSyncRepository.markFailed(syncRecord.id, errorMessage, userId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Update an existing customer in QuickBooks
   */
  async updateCustomerInQbo(
    customer: Customer,
    syncRecord: QboEntitySync,
    connectionId: string,
    userId?: string
  ): Promise<SyncCustomerResult> {
    try {
      if (!syncRecord.qboEntityId) {
        throw new Error('No QBO customer ID found');
      }

      // Map customer to QBO format
      const qboCustomer = mapCustomerToQboFormat(customer);

      // Update in QBO
      const result = await quickBooksProvider.updateCustomer(
        connectionId,
        syncRecord.qboEntityId,
        qboCustomer
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
        `Customer ${customer.customerCode} updated in QBO (ID: ${syncRecord.qboEntityId})`
      );

      return {
        success: true,
        qboCustomerId: result.externalId || syncRecord.qboEntityId,
        syncRecord: updatedSync,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update customer in QBO:', errorMessage);

      // Mark sync as failed (but don't change status from synced if it was already synced)
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
   * Queue a customer for sync (creates pending record)
   * Used when QBO is not connected or for batch processing
   */
  async queueCustomerForSync(
    customerId: string,
    realmId: string,
    userId?: string
  ): Promise<QboEntitySync> {
    return await qboSyncRepository.upsert(
      {
        entityType: 'customer',
        entityId: customerId,
        qboRealmId: realmId,
        syncStatus: 'pending',
        syncDirection: 'push',
      },
      userId
    );
  },

  /**
   * Process pending customer syncs
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
      'customer',
      qboConnection.realmId,
      limit
    );

    console.log(`Processing ${pendingSyncs.length} pending customer syncs`);

    for (const pendingSync of pendingSyncs) {
      try {
        // Get customer data
        const { customerRepository } = await import('@/features/customers/repositories');
        const customer = await customerRepository.findById(pendingSync.entityId);

        if (!customer) {
          // Customer was deleted, remove sync record
          await qboSyncRepository.remove(pendingSync.id);
          results.push({
            success: false,
            entityType: 'customer',
            entityId: pendingSync.entityId,
            error: 'Customer not found',
          });
          continue;
        }

        // Get full sync record
        const syncRecord = await qboSyncRepository.findById(pendingSync.id);
        if (!syncRecord) {
          continue;
        }

        // Sync customer
        const result = await this.createCustomerInQbo(
          customer,
          syncRecord,
          qboConnection.connectionId
        );

        results.push({
          success: result.success,
          entityType: 'customer',
          entityId: customer.id,
          qboEntityId: result.qboCustomerId,
          error: result.error,
        });
      } catch (error) {
        results.push({
          success: false,
          entityType: 'customer',
          entityId: pendingSync.entityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  },

  /**
   * Retry failed customer syncs
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

    console.log(`Retrying ${failedSyncs.length} failed customer syncs`);

    for (const failedSync of failedSyncs) {
      // Reset to pending and process
      await qboSyncRepository.resetToPending(failedSync.id);
    }

    // Process the reset pending syncs
    return await this.processPendingSyncs(limit);
  },

  /**
   * Get sync status for a customer
   */
  async getSyncStatus(
    customerId: string,
    realmId?: string
  ): Promise<QboEntitySync | null> {
    if (!realmId) {
      const qboConnection = await getQboConnection();
      if (!qboConnection) {
        return null;
      }
      realmId = qboConnection.realmId;
    }

    return await qboSyncRepository.findByEntity('customer', customerId, realmId);
  },

  /**
   * Get QBO customer ID for a synced customer
   */
  async getQboCustomerId(customerId: string): Promise<string | null> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return null;
    }

    return await qboSyncRepository.getQboEntityId(
      'customer',
      customerId,
      qboConnection.realmId
    );
  },

  /**
   * Check if customer is synced to QBO
   */
  async isCustomerSynced(customerId: string): Promise<boolean> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return false;
    }

    return await qboSyncRepository.isSynced(
      'customer',
      customerId,
      qboConnection.realmId
    );
  },
};

export type QboCustomerSyncService = typeof qboCustomerSyncService;
