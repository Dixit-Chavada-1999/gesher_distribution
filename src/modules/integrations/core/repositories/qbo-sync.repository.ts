/**
 * QBO Entity Sync Repository
 *
 * Data access layer for QuickBooks entity sync tracking.
 * Handles CRUD operations for the qbo_entity_sync table.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  QboEntitySync,
  QboEntitySyncRow,
  QboEntitySyncInsert,
  QboEntitySyncUpdate,
  QboEntitySyncQuery,
  QboEntityType,
  QboSyncStatus,
  PendingSyncItem,
  FailedSyncItem,
} from '../types/qbo-sync.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map database row to application entity
 */
function mapRowToEntity(row: QboEntitySyncRow): QboEntitySync {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    qboEntityId: row.qbo_entity_id,
    qboRealmId: row.qbo_realm_id,
    syncStatus: row.sync_status,
    syncDirection: row.sync_direction,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
    nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
    lastError: row.last_error,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Calculate next retry time with exponential backoff
 * Retry delays: 1min, 5min, 15min, 30min, 1hr, 2hr, 4hr, etc.
 */
function calculateNextRetryTime(retryCount: number): Date {
  const baseDelayMs = 60 * 1000; // 1 minute
  const maxDelayMs = 4 * 60 * 60 * 1000; // 4 hours
  const delayMs = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
  return new Date(Date.now() + delayMs);
}

// ============================================
// QUERY OPERATIONS
// ============================================

/**
 * Find sync record by entity type and ID
 */
export async function findByEntity(
  entityType: QboEntityType,
  entityId: string,
  qboRealmId: string
): Promise<QboEntitySync | null> {
  const { data, error } = await db
    .from('qbo_entity_sync')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('qbo_realm_id', qboRealmId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find sync record: ${error.message}`);
  }

  return data ? mapRowToEntity(data as QboEntitySyncRow) : null;
}

/**
 * Find sync record by QBO entity ID
 */
export async function findByQboId(
  entityType: QboEntityType,
  qboEntityId: string,
  qboRealmId: string
): Promise<QboEntitySync | null> {
  const { data, error } = await db
    .from('qbo_entity_sync')
    .select('*')
    .eq('entity_type', entityType)
    .eq('qbo_entity_id', qboEntityId)
    .eq('qbo_realm_id', qboRealmId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find sync record by QBO ID: ${error.message}`);
  }

  return data ? mapRowToEntity(data as QboEntitySyncRow) : null;
}

/**
 * Find sync record by ID
 */
export async function findById(id: string): Promise<QboEntitySync | null> {
  const { data, error } = await db
    .from('qbo_entity_sync')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find sync record: ${error.message}`);
  }

  return data ? mapRowToEntity(data as QboEntitySyncRow) : null;
}

/**
 * Find all sync records matching query
 */
export async function findMany(query: QboEntitySyncQuery = {}): Promise<QboEntitySync[]> {
  let dbQuery = db.from('qbo_entity_sync').select('*');

  if (query.entityType) {
    dbQuery = dbQuery.eq('entity_type', query.entityType);
  }
  if (query.entityId) {
    dbQuery = dbQuery.eq('entity_id', query.entityId);
  }
  if (query.qboRealmId) {
    dbQuery = dbQuery.eq('qbo_realm_id', query.qboRealmId);
  }
  if (query.syncStatus) {
    dbQuery = dbQuery.eq('sync_status', query.syncStatus);
  }
  if (query.syncDirection) {
    dbQuery = dbQuery.eq('sync_direction', query.syncDirection);
  }

  dbQuery = dbQuery.order('created_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to find sync records: ${error.message}`);
  }

  return (data || []).map((row) => mapRowToEntity(row as QboEntitySyncRow));
}

/**
 * Get pending sync items for processing
 */
export async function getPendingSyncs(
  entityType?: QboEntityType,
  qboRealmId?: string,
  limit: number = 50
): Promise<PendingSyncItem[]> {
  let query = db
    .from('qbo_entity_sync')
    .select('id, entity_type, entity_id, qbo_realm_id, retry_count, max_retries, created_at')
    .eq('sync_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get pending syncs: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    entityType: row.entity_type as QboEntityType,
    entityId: row.entity_id,
    qboRealmId: row.qbo_realm_id,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Get failed syncs ready for retry
 */
export async function getFailedSyncsForRetry(
  qboRealmId?: string,
  limit: number = 50
): Promise<FailedSyncItem[]> {
  let query = db
    .from('qbo_entity_sync')
    .select('id, entity_type, entity_id, qbo_realm_id, retry_count, max_retries, created_at, last_error, next_retry_at')
    .eq('sync_status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(limit);

  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get failed syncs: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    entityType: row.entity_type as QboEntityType,
    entityId: row.entity_id,
    qboRealmId: row.qbo_realm_id,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    createdAt: new Date(row.created_at),
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
  }));
}

/**
 * Get sync statistics by status
 */
export async function getSyncStats(
  qboRealmId?: string,
  entityType?: QboEntityType
): Promise<Record<QboSyncStatus, number>> {
  let query = db.from('qbo_entity_sync').select('sync_status');

  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }
  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get sync stats: ${error.message}`);
  }

  const stats: Record<QboSyncStatus, number> = {
    pending: 0,
    synced: 0,
    failed: 0,
    error: 0,
  };

  (data || []).forEach((row) => {
    const status = row.sync_status as QboSyncStatus;
    stats[status] = (stats[status] || 0) + 1;
  });

  return stats;
}

// ============================================
// CREATE OPERATIONS
// ============================================

/**
 * Create a new sync record
 */
export async function create(
  data: QboEntitySyncInsert,
  userId?: string
): Promise<QboEntitySync> {
  const insertData = {
    entity_type: data.entityType,
    entity_id: data.entityId,
    qbo_realm_id: data.qboRealmId,
    qbo_entity_id: data.qboEntityId || null,
    sync_status: data.syncStatus || 'pending',
    sync_direction: data.syncDirection || 'push',
    last_error: data.lastError || null,
    created_by: userId || data.createdBy || null,
    updated_by: userId || data.createdBy || null,
  };

  const { data: result, error } = await db
    .from('qbo_entity_sync')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create sync record: ${error.message}`);
  }

  return mapRowToEntity(result as QboEntitySyncRow);
}

/**
 * Create or update sync record (upsert)
 */
export async function upsert(
  data: QboEntitySyncInsert,
  userId?: string
): Promise<QboEntitySync> {
  const insertData = {
    entity_type: data.entityType,
    entity_id: data.entityId,
    qbo_realm_id: data.qboRealmId,
    qbo_entity_id: data.qboEntityId || null,
    sync_status: data.syncStatus || 'pending',
    sync_direction: data.syncDirection || 'push',
    last_error: data.lastError || null,
    created_by: userId || data.createdBy || null,
    updated_by: userId || data.createdBy || null,
  };

  const { data: result, error } = await db
    .from('qbo_entity_sync')
    .upsert(insertData, {
      onConflict: 'entity_type,entity_id,qbo_realm_id',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert sync record: ${error.message}`);
  }

  return mapRowToEntity(result as QboEntitySyncRow);
}

// ============================================
// UPDATE OPERATIONS
// ============================================

/**
 * Update a sync record
 */
export async function update(
  id: string,
  data: QboEntitySyncUpdate,
  userId?: string
): Promise<QboEntitySync> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId || data.updatedBy || null,
  };

  if (data.qboEntityId !== undefined) {
    updateData.qbo_entity_id = data.qboEntityId;
  }
  if (data.syncStatus !== undefined) {
    updateData.sync_status = data.syncStatus;
  }
  if (data.lastSyncedAt !== undefined) {
    updateData.last_synced_at = data.lastSyncedAt?.toISOString() || null;
  }
  if (data.nextRetryAt !== undefined) {
    updateData.next_retry_at = data.nextRetryAt?.toISOString() || null;
  }
  if (data.lastError !== undefined) {
    updateData.last_error = data.lastError;
  }
  if (data.retryCount !== undefined) {
    updateData.retry_count = data.retryCount;
  }

  const { data: result, error } = await db
    .from('qbo_entity_sync')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update sync record: ${error.message}`);
  }

  return mapRowToEntity(result as QboEntitySyncRow);
}

/**
 * Mark sync as successful
 */
export async function markSynced(
  id: string,
  qboEntityId: string,
  userId?: string
): Promise<QboEntitySync> {
  return update(
    id,
    {
      qboEntityId,
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
      lastError: null,
      nextRetryAt: null,
    },
    userId
  );
}

/**
 * Mark sync as failed with retry
 */
export async function markFailed(
  id: string,
  error: string,
  userId?: string
): Promise<QboEntitySync> {
  // Get current record to check retry count
  const current = await findById(id);
  if (!current) {
    throw new Error('Sync record not found');
  }

  const newRetryCount = current.retryCount + 1;
  const maxRetriesReached = newRetryCount >= current.maxRetries;

  return update(
    id,
    {
      syncStatus: maxRetriesReached ? 'error' : 'failed',
      lastError: error,
      retryCount: newRetryCount,
      nextRetryAt: maxRetriesReached ? null : calculateNextRetryTime(newRetryCount),
    },
    userId
  );
}

/**
 * Mark sync as permanent error (no more retries)
 */
export async function markError(
  id: string,
  error: string,
  userId?: string
): Promise<QboEntitySync> {
  return update(
    id,
    {
      syncStatus: 'error',
      lastError: error,
      nextRetryAt: null,
    },
    userId
  );
}

/**
 * Reset sync to pending (for manual retry)
 */
export async function resetToPending(
  id: string,
  userId?: string
): Promise<QboEntitySync> {
  return update(
    id,
    {
      syncStatus: 'pending',
      lastError: null,
      retryCount: 0,
      nextRetryAt: null,
    },
    userId
  );
}

// ============================================
// DELETE OPERATIONS
// ============================================

/**
 * Delete a sync record
 */
export async function remove(id: string): Promise<void> {
  const { error } = await db
    .from('qbo_entity_sync')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete sync record: ${error.message}`);
  }
}

/**
 * Delete sync record by entity
 */
export async function removeByEntity(
  entityType: QboEntityType,
  entityId: string,
  qboRealmId: string
): Promise<void> {
  const { error } = await db
    .from('qbo_entity_sync')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('qbo_realm_id', qboRealmId);

  if (error) {
    throw new Error(`Failed to delete sync record: ${error.message}`);
  }
}

// ============================================
// UTILITY OPERATIONS
// ============================================

/**
 * Check if entity is synced
 */
export async function isSynced(
  entityType: QboEntityType,
  entityId: string,
  qboRealmId: string
): Promise<boolean> {
  const record = await findByEntity(entityType, entityId, qboRealmId);
  return record?.syncStatus === 'synced' && record?.qboEntityId !== null;
}

/**
 * Get QBO entity ID for a synced entity
 */
export async function getQboEntityId(
  entityType: QboEntityType,
  entityId: string,
  qboRealmId: string
): Promise<string | null> {
  const record = await findByEntity(entityType, entityId, qboRealmId);
  return record?.qboEntityId || null;
}

/**
 * Bulk create sync records for pending items
 */
export async function bulkCreatePending(
  items: Array<{
    entityType: QboEntityType;
    entityId: string;
    qboRealmId: string;
  }>,
  userId?: string
): Promise<number> {
  if (items.length === 0) {
    return 0;
  }

  const insertData = items.map((item) => ({
    entity_type: item.entityType,
    entity_id: item.entityId,
    qbo_realm_id: item.qboRealmId,
    sync_status: 'pending' as const,
    sync_direction: 'push' as const,
    created_by: userId || null,
    updated_by: userId || null,
  }));

  const { error, count } = await db
    .from('qbo_entity_sync')
    .upsert(insertData, {
      onConflict: 'entity_type,entity_id,qbo_realm_id',
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`Failed to bulk create sync records: ${error.message}`);
  }

  return count || items.length;
}
