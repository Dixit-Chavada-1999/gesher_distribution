/**
 * Product by ID API Routes
 *
 * GET /api/products/[id] - Get a single product
 * PUT /api/products/[id] - Update a product
 * DELETE /api/products/[id] - Soft delete a product
 */

import { NextRequest } from 'next/server';
import { productService } from '@/features/products/services/product.service';
import { updateProductSchema } from '@/features/products/lib/schemas';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  noContentResponse,
} from '@/shared/lib/api/response';
import { createClient } from '@/shared/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]
 * Get a single product by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Fetch product
    const result = await productService.getById(id);

    if (!result.success) {
      if (result.error === 'Product not found') {
        return notFoundResponse('Product');
      }
      return internalErrorResponse(result.error);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/products/[id] error:', error);
    return internalErrorResponse('Failed to fetch product');
  }
}

/**
 * PUT /api/products/[id]
 * Update a product
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (products.edit)

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = updateProductSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Update product
    const result = await productService.update(id, validation.data, user.id);

    if (!result.success) {
      if (result.error === 'Product not found') {
        return notFoundResponse('Product');
      }
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to update product');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('PUT /api/products/[id] error:', error);
    return internalErrorResponse('Failed to update product');
  }
}

/**
 * DELETE /api/products/[id]
 * Soft delete a product
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (products.delete)

    // Delete product
    const result = await productService.delete(id, user.id);

    if (!result.success) {
      if (result.error === 'Product not found') {
        return notFoundResponse('Product');
      }
      return badRequestResponse(result.error || 'Failed to delete product');
    }

    return noContentResponse();
  } catch (error) {
    console.error('DELETE /api/products/[id] error:', error);
    return internalErrorResponse('Failed to delete product');
  }
}
