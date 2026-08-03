/**
 * QBO Entity Sync Types
 *
 * Type definitions for the centralized QuickBooks entity sync tracking.
 */

// ============================================
// DATABASE ENUMS (match migration 038)
// ============================================

export type QboSyncStatus = 'pending' | 'synced' | 'failed' | 'error';

export type QboSyncDirection = 'push' | 'pull';

export type QboEntityType =
  | 'customer'
  | 'product'
  | 'invoice'
  | 'bill'
  | 'payment'
  | 'credit_memo';

// ============================================
// DATABASE ROW TYPE
// ============================================

/**
 * QBO Entity Sync row from database
 */
export interface QboEntitySyncRow {
  id: string;
  entity_type: QboEntityType;
  entity_id: string;
  qbo_entity_id: string | null;
  qbo_realm_id: string;
  sync_status: QboSyncStatus;
  sync_direction: QboSyncDirection;
  last_synced_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// ENTITY TYPE (camelCase for application use)
// ============================================

/**
 * QBO Entity Sync entity for application use
 */
export interface QboEntitySync {
  id: string;
  entityType: QboEntityType;
  entityId: string;
  qboEntityId: string | null;
  qboRealmId: string;
  syncStatus: QboSyncStatus;
  syncDirection: QboSyncDirection;
  lastSyncedAt: Date | null;
  nextRetryAt: Date | null;
  lastError: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ============================================
// INSERT/UPDATE TYPES
// ============================================

/**
 * Data for creating a new sync record
 */
export interface QboEntitySyncInsert {
  entityType: QboEntityType;
  entityId: string;
  qboRealmId: string;
  qboEntityId?: string | null;
  syncStatus?: QboSyncStatus;
  syncDirection?: QboSyncDirection;
  lastError?: string | null;
  createdBy?: string | null;
}

/**
 * Data for updating a sync record
 */
export interface QboEntitySyncUpdate {
  qboEntityId?: string | null;
  syncStatus?: QboSyncStatus;
  lastSyncedAt?: Date | null;
  nextRetryAt?: Date | null;
  lastError?: string | null;
  retryCount?: number;
  updatedBy?: string | null;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Query parameters for finding sync records
 */
export interface QboEntitySyncQuery {
  entityType?: QboEntityType;
  entityId?: string;
  qboRealmId?: string;
  syncStatus?: QboSyncStatus;
  syncDirection?: QboSyncDirection;
}

/**
 * Pending sync item for processing queue
 */
export interface PendingSyncItem {
  id: string;
  entityType: QboEntityType;
  entityId: string;
  qboRealmId: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

/**
 * Failed sync item for retry queue
 */
export interface FailedSyncItem extends PendingSyncItem {
  lastError: string | null;
  nextRetryAt: Date | null;
}

// ============================================
// RESULT TYPES
// ============================================

/**
 * Result of a sync operation
 */
export interface QboSyncResult {
  success: boolean;
  entityType: QboEntityType;
  entityId: string;
  qboEntityId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Batch sync result
 */
export interface QboBatchSyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: QboSyncResult[];
}

// ============================================
// STATUS CONSTANTS
// ============================================

export const QBO_SYNC_STATUS_LABELS: Record<QboSyncStatus, string> = {
  pending: 'Pending',
  synced: 'Synced',
  failed: 'Failed',
  error: 'Error',
};

export const QBO_SYNC_STATUS_COLORS: Record<QboSyncStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  synced: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  failed: 'bg-orange-100 text-orange-800 border border-orange-200',
  error: 'bg-red-100 text-red-800 border border-red-200',
};

export const QBO_ENTITY_TYPE_LABELS: Record<QboEntityType, string> = {
  customer: 'Customer',
  product: 'Product',
  invoice: 'Invoice',
  bill: 'Bill',
  payment: 'Payment',
  credit_memo: 'Credit Memo',
};
