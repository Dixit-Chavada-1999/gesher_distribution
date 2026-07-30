/**
 * Products Server Actions
 *
 * Server actions for the Products module.
 * Can be called directly from Server Components or via useFormState.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { productService } from '../services/product.service';
import { createProductSchema, updateProductSchema, productFormSchema, formToCreateDTO } from '../lib/schemas';
import type { ProductListParams, Product } from '../types';
import { createClient } from '@/shared/lib/supabase/server';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of products
 */
export async function getProducts(params: ProductListParams = {}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.list(params);
}

/**
 * Get a single product by ID
 */
export async function getProduct(id: string): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.getById(id);
}

/**
 * Get a single product by SKU
 */
export async function getProductBySku(sku: string): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.getBySku(sku);
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new product
 */
export async function createProduct(formData: FormData): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

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

  const result = await productService.create(validation.data, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath('/api/products');
  }

  return result;
}

/**
 * Create product from JSON data (for programmatic use)
 */
export async function createProductFromData(data: unknown): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Validate
  const validation = createProductSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.create(validation.data, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath('/api/products');
  }

  return result;
}

/**
 * Update an existing product
 */
export async function updateProduct(id: string, formData: FormData): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

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

  const result = await productService.update(id, validation.data, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    revalidatePath('/api/products');
  }

  return result;
}

/**
 * Update product from JSON data (for programmatic use)
 */
export async function updateProductFromData(id: string, data: unknown): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Validate
  const validation = updateProductSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await productService.update(id, validation.data, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
    revalidatePath('/api/products');
  }

  return result;
}

/**
 * Soft delete a product
 */
export async function deleteProduct(id: string): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await productService.delete(id, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath('/api/products');
  }

  return result;
}

/**
 * Restore a soft-deleted product
 */
export async function restoreProduct(id: string): Promise<ActionResult<Product>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await productService.restore(id, user.id);

  if (result.success) {
    revalidatePath('/products');
    revalidatePath('/api/products');
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.getCategories();
}

/**
 * Get product counts by status
 */
export async function getProductStatusCounts(): Promise<ActionResult<Record<string, number>>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.getStatusCounts();
}

/**
 * Validate SKU uniqueness
 */
export async function validateProductSku(sku: string, excludeId?: string): Promise<ActionResult<boolean>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return productService.validateSku(sku, excludeId);
}
