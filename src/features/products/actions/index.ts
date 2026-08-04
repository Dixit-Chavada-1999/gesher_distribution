/**
 * Products Server Actions
 *
 * Server actions for the Products module.
 * Can be called directly from Server Components or via useFormState.
 *
 * Every action authenticates the caller and checks the matching
 * `products.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { productService } from '../services/product.service';
import { createProductSchema, updateProductSchema, productFormSchema, formToCreateDTO } from '../lib/schemas';
import type { ProductListParams, Product, ProductTableRow, ProductWithFormattedPrices } from '../types';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface ProductListResult {
  data: ProductTableRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// AUTHORIZATION HELPER
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 *
 * Returns the app user (users.id — NOT the Supabase auth id), which is what
 * the `created_by` / `updated_by` foreign keys reference.
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

/**
 * Same as `authorize`, but any one of the permissions is enough.
 *
 * Used for reads that more than one role shape needs — editing a product, for
 * example, requires loading it first.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

/**
 * Revalidate every route that renders product data
 */
function revalidateProducts(): void {
  revalidatePath('/products');
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of products
 */
export async function getProducts(params: ProductListParams = {}): Promise<ActionResult<ProductListResult>> {
  const auth = await authorize('products.view_module');
  if (!auth.ok) {return auth.result;}

  return productService.list(params);
}

/**
 * Get a single product by ID
 */
export async function getProduct(id: string): Promise<ActionResult<ProductWithFormattedPrices>> {
  const auth = await authorizeAny(['products.view_detail', 'products.edit']);
  if (!auth.ok) {return auth.result;}

  return productService.getById(id);
}

/**
 * Get a single product by SKU
 */
export async function getProductBySku(sku: string): Promise<ActionResult<ProductWithFormattedPrices>> {
  const auth = await authorizeAny(['products.view_detail', 'products.edit']);
  if (!auth.ok) {return auth.result;}

  return productService.getBySku(sku);
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new product from a submitted HTML form
 */
export async function createProduct(formData: FormData): Promise<ActionResult<Product>> {
  const auth = await authorize('products.create');
  if (!auth.ok) {return auth.result;}

  // Parse form data
  const rawData = {
    sku: formData.get('sku') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
    shortDescription: formData.get('shortDescription') as string,
    category: formData.get('category') as string,
    rimSize: formData.get('rimSize') as string,
    tireSize: formData.get('tireSize') as string,
    weightLbs: formData.get('weightLbs') as string,
    baseCost: formData.get('baseCost') as string,
    basePrice: formData.get('basePrice') as string,
    status: (formData.get('status') as 'active' | 'inactive' | 'discontinued') || 'active',
    isSellable: formData.get('isSellable') === 'true',
    imageUrl: formData.get('imageUrl') as string,
  };

  // Validate form data
  const formValidation = productFormSchema.safeParse(rawData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Convert to DTO and validate
  const dto = formToCreateDTO(formValidation.data);
  const validation = createProductSchema.safeParse(dto);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.create(validation.data, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

/**
 * Create product from JSON data (for programmatic use)
 */
export async function createProductFromData(data: unknown): Promise<ActionResult<Product>> {
  const auth = await authorize('products.create');
  if (!auth.ok) {return auth.result;}

  // Validate
  const validation = createProductSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.create(validation.data, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

/**
 * Update an existing product from a submitted HTML form
 */
export async function updateProduct(id: string, formData: FormData): Promise<ActionResult<Product>> {
  const auth = await authorize('products.edit');
  if (!auth.ok) {return auth.result;}

  // Parse form data (only include fields that were submitted)
  const rawData: Record<string, unknown> = {};

  const fields = ['sku', 'name', 'description', 'shortDescription', 'category',
                  'rimSize', 'tireSize', 'weightLbs', 'baseCost', 'basePrice',
                  'status', 'isSellable', 'imageUrl'];

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null) {
      if (field === 'isSellable') {
        rawData[field] = value === 'true';
      } else if (field === 'weightLbs' && value) {
        rawData[field] = parseFloat(value as string);
      } else if ((field === 'baseCost' || field === 'basePrice') && value) {
        rawData[field] = Math.round(parseFloat((value as string).replace(/[^0-9.]/g, '')) * 100);
      } else {
        rawData[field] = value;
      }
    }
  }

  // Validate
  const validation = updateProductSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.update(id, validation.data, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

/**
 * Update product from JSON data (for programmatic use)
 */
export async function updateProductFromData(id: string, data: unknown): Promise<ActionResult<Product>> {
  const auth = await authorize('products.edit');
  if (!auth.ok) {return auth.result;}

  // Validate
  const validation = updateProductSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.update(id, validation.data, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

/**
 * Soft delete a product
 */
export async function deleteProduct(id: string): Promise<ActionResult<Product>> {
  const auth = await authorize('products.delete');
  if (!auth.ok) {return auth.result;}

  const result = await productService.delete(id, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

/**
 * Restore a soft-deleted product
 */
export async function restoreProduct(id: string): Promise<ActionResult<Product>> {
  const auth = await authorize('products.delete');
  if (!auth.ok) {return auth.result;}

  const result = await productService.restore(id, auth.user.id);

  if (result.success) {
    revalidateProducts();
  }

  return result;
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get all product categories
 */
export async function getProductCategories(): Promise<ActionResult<string[]>> {
  const auth = await authorize('products.view_module');
  if (!auth.ok) {return auth.result;}

  return productService.getCategories();
}

/**
 * Get product counts by status
 */
export async function getProductStatusCounts(): Promise<ActionResult<Record<string, number>>> {
  const auth = await authorize('products.view_module');
  if (!auth.ok) {return auth.result;}

  return productService.getStatusCounts();
}

/**
 * Validate SKU uniqueness
 */
export async function validateProductSku(sku: string, excludeId?: string): Promise<ActionResult<boolean>> {
  const auth = await authorize('products.view_module');
  if (!auth.ok) {return auth.result;}

  return productService.validateSku(sku, excludeId);
}
