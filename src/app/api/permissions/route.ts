/**
 * Permissions API Routes
 *
 * GET /api/permissions - Get all permissions
 * POST /api/permissions/seed - Seed default permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { permissionService } from '@/features/roles';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const querySchema = z.object({
  search: z.string().optional(),
  module: z.string().optional(),
  grouped: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

// ============================================
// GET /api/permissions
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      search: searchParams.get('search') || undefined,
      module: searchParams.get('module') || undefined,
      grouped: searchParams.get('grouped') || undefined,
    });

    if (query.grouped) {
      const permissions = await permissionService.getPermissionsGrouped();
      return NextResponse.json({
        success: true,
        data: permissions,
      });
    }

    const permissions = await permissionService.getAllPermissions({
      search: query.search,
      module: query.module,
    });

    return NextResponse.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('GET /api/permissions error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch permissions',
      },
      { status: 500 }
    );
  }
}
