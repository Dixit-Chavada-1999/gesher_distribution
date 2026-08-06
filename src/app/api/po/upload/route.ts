/**
 * PO Upload API Route
 *
 * POST /api/po/upload - Upload PO PDF to local server storage
 * GET /api/po/upload?file=<path> - Download/view uploaded file
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';

// ============================================
// CONSTANTS
// ============================================

// Store files in 'uploads' folder at project root (outside public for security)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'po-documents');
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(subDir?: string): Promise<string> {
  const targetDir = subDir ? path.join(UPLOAD_DIR, subDir) : UPLOAD_DIR;

  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  return targetDir;
}

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
 * Upload PO PDF to local storage
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

    // Determine subdirectory (organize by quote or uploads)
    const subDir = quoteId ? `quotes/${quoteId}` : 'uploads';
    const uploadDir = await ensureUploadDir(subDir);

    // Generate unique filename
    const filename = generateFilename(file.name);
    const filepath = path.join(uploadDir, filename);

    // Convert File to Buffer and write to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filepath, buffer);

    // Return relative path (from uploads folder)
    const relativePath = path.join(subDir, filename).replace(/\\/g, '/');

    // Generate URL for accessing the file
    const fileUrl = `/api/po/upload?file=${encodeURIComponent(relativePath)}`;

    return successResponse({
      path: relativePath,
      url: fileUrl,
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
 * Download/view uploaded PO PDF
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
    const fullPath = path.join(UPLOAD_DIR, sanitizedPath);

    // Ensure file is within upload directory (security check)
    if (!fullPath.startsWith(UPLOAD_DIR)) {
      return badRequestResponse('Invalid file path');
    }

    // Check if file exists
    try {
      await stat(fullPath);
    } catch {
      return notFoundResponse('File');
    }

    // Read file
    const fileBuffer = await readFile(fullPath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/po/upload error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
