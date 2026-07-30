/**
 * Document Storage Service
 *
 * Handles file uploads, downloads, and signed URLs for customer documents.
 * Uses Supabase Storage.
 */

import { db } from '@/shared/lib/supabase/database';

// ============================================
// CONSTANTS
// ============================================

const BUCKET_NAME = 'customer-documents';
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

// ============================================
// TYPES
// ============================================

export interface UploadResult {
  path: string;
  fullPath: string;
}

export interface StorageError {
  message: string;
  statusCode?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate storage path for a document
 */
export function generateStoragePath(
  customerId: string,
  documentTypeCode: string,
  version: number,
  fileName: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${customerId}/${documentTypeCode.toLowerCase()}/v${version}_${date}_${sanitizedFileName}`;
}

/**
 * Extract customer ID from storage path
 */
export function extractCustomerIdFromPath(path: string): string | null {
  const parts = path.split('/');
  return parts.length > 0 ? parts[0] : null;
}

// ============================================
// STORAGE OPERATIONS
// ============================================

/**
 * Upload a file to storage
 */
export async function uploadFile(
  file: File,
  storagePath: string
): Promise<UploadResult> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    path: data.path,
    fullPath: `${BUCKET_NAME}/${data.path}`,
  };
}

/**
 * Upload a file from buffer (for server-side operations)
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<UploadResult> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return {
    path: data.path,
    fullPath: `${BUCKET_NAME}/${data.path}`,
  };
}

/**
 * Get a signed URL for downloading/viewing a file
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<string> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error('Signed URL error:', error);
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files
 */
export async function getSignedUrls(
  storagePaths: string[],
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<Record<string, string>> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .createSignedUrls(storagePaths, expiresIn);

  if (error) {
    console.error('Signed URLs error:', error);
    throw new Error(`Failed to create signed URLs: ${error.message}`);
  }

  const urlMap: Record<string, string> = {};
  data.forEach((item) => {
    if (item.signedUrl && item.path) {
      urlMap[item.path] = item.signedUrl;
    }
  });

  return urlMap;
}

/**
 * Download a file
 */
export async function downloadFile(storagePath: string): Promise<Blob> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error) {
    console.error('Download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }

  return data;
}

/**
 * Delete a file from storage
 * Note: Generally we don't hard delete - use for cleanup only
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const { error } = await db.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Delete multiple files from storage
 */
export async function deleteFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) {return;}

  const { error } = await db.storage
    .from(BUCKET_NAME)
    .remove(storagePaths);

  if (error) {
    console.error('Delete files error:', error);
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

/**
 * List files in a customer's folder
 */
export async function listCustomerFiles(customerId: string): Promise<string[]> {
  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .list(customerId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error) {
    console.error('List files error:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data.map((file) => `${customerId}/${file.name}`);
}

/**
 * Check if bucket exists and is accessible
 */
export async function checkBucketAccess(): Promise<boolean> {
  try {
    const { error } = await db.storage.getBucket(BUCKET_NAME);
    return !error;
  } catch {
    return false;
  }
}

// ============================================
// EXPORT BUCKET NAME
// ============================================

export { BUCKET_NAME, SIGNED_URL_EXPIRY };
