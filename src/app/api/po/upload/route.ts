/**
 * PO Upload API Route
 *
 * POST /api/po/upload - Upload PO PDF to Supabase Storage
 * GET /api/po/upload?file=<path> - Download/view uploaded file
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';
import { createClient } from '@/shared/lib/supabase/server';

// ============================================
// CONSTANTS
// ============================================

const BUCKET_NAME = 'po-documents';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique filename
 */
function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}_${random}_${sanitizedName}`;
}

// ============================================
// POST /api/po/upload
// ============================================

/**
 * Upload PO PDF to Supabase Storage
 *
 * Request: FormData with 'file' field
 * Response: { path: string, url: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('quotes.create');
    if (guard.response) {
      return guard.response;
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quoteId = formData.get('quoteId') as string | null;

    // Validate file
    if (!file) {
      return badRequestResponse('No file provided');
    }

    if (file.type !== 'application/pdf') {
      return badRequestResponse('Only PDF files are allowed');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return badRequestResponse(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Determine storage path (organize by quote or uploads)
    const subDir = quoteId ? `quotes/${quoteId}` : 'uploads';
    const filename = generateFilename(file.name);
    const storagePath = `${subDir}/${filename}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      return internalErrorResponse(`Failed to upload file: ${error.message}`);
    }

    // Get public URL for the file
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return successResponse({
      path: data.path,
      url: urlData.publicUrl,
      filename: filename,
    });
  } catch (error) {
    console.error('POST /api/po/upload error:', error);
    return internalErrorResponse('Failed to upload file');
  }
}

// ============================================
// GET /api/po/upload?file=<path>
// ============================================

/**
 * Download/view uploaded PO PDF from Supabase Storage
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('quotes.view_module');
    if (guard.response) {
      return guard.response;
    }

    // Get file path from query
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');

    if (!filePath) {
      return badRequestResponse('File path is required');
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');

    // Initialize Supabase client
    const supabase = await createClient();

    // Download file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(sanitizedPath);

    if (error) {
      console.error('Supabase Storage download error:', error);
      return notFoundResponse('File');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizedPath.split('/').pop()}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/po/upload error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
