/**
 * Products Module - Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================
// BASE SCHEMAS
// ============================================

/**
 * Product status enum
 */
export const productStatusSchema = z.enum(['active', 'inactive', 'discontinued']);

/**
 * SKU format validation (uppercase alphanumeric with hyphens)
 */
export const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be 50 characters or less')
  .regex(/^[A-Z0-9\-]+$/, 'SKU must be uppercase letters, numbers, and hyphens only')
  .transform((val) => val.toUpperCase());

/**
 * Price validation (positive number in cents)
 */
export const priceInCentsSchema = z
  .number()
  .int('Price must be a whole number (cents)')
  .min(0, 'Price cannot be negative');

/**
 * Price from string (converts dollars to cents)
 */
export const priceFromStringSchema = z
  .string()
  .transform((val) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const dollars = parseFloat(cleaned);
    if (isNaN(dollars)) return 0;
    return Math.round(dollars * 100); // Convert to cents
  })
  .pipe(priceInCentsSchema);

// ============================================
// CREATE PRODUCT SCHEMA
// ============================================

export const createProductSchema = z.object({
  sku: skuSchema,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be 200 characters or less'),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  shortDescription: z.string().max(500, 'Short description too long').optional().nullable(),
  category: z.string().max(100, 'Category too long').optional().nullable(),
  rimSize: z.string().max(20, 'Rim size too long').optional().nullable(),
  tireSize: z.string().max(50, 'Tire size too long').optional().nullable(),
  weightLbs: z
    .number()
    .positive('Weight must be positive')
    .max(10000, 'Weight too large')
    .optional()
    .nullable(),
  baseCost: priceInCentsSchema,
  basePrice: priceInCentsSchema,
  status: productStatusSchema.default('active'),
  isSellable: z.boolean().default(true),
  imageUrl: z.string().url('Invalid image URL').optional().nullable().or(z.literal('')),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ============================================
// UPDATE PRODUCT SCHEMA
// ============================================

export const updateProductSchema = z.object({
  sku: skuSchema.optional(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be 200 characters or less')
    .optional(),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  shortDescription: z.string().max(500, 'Short description too long').optional().nullable(),
  category: z.string().max(100, 'Category too long').optional().nullable(),
  rimSize: z.string().max(20, 'Rim size too long').optional().nullable(),
  tireSize: z.string().max(50, 'Tire size too long').optional().nullable(),
  weightLbs: z
    .number()
    .positive('Weight must be positive')
    .max(10000, 'Weight too large')
    .optional()
    .nullable(),
  baseCost: priceInCentsSchema.optional(),
  basePrice: priceInCentsSchema.optional(),
  status: productStatusSchema.optional(),
  isSellable: z.boolean().optional(),
  imageUrl: z.string().url('Invalid image URL').optional().nullable().or(z.literal('')),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const productFormSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be 50 characters or less')
    .regex(/^[A-Za-z0-9\-]+$/, 'SKU must be letters, numbers, and hyphens only'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be 200 characters or less'),
  description: z.string().max(5000, 'Description too long').optional(),
  shortDescription: z.string().max(500, 'Short description too long').optional(),
  category: z.string().max(100, 'Category too long').optional(),
  rimSize: z.string().max(20, 'Rim size too long').optional(),
  tireSize: z.string().max(50, 'Tire size too long').optional(),
  weightLbs: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      'Weight must be a positive number'
    ),
  baseCost: z
    .string()
    .min(1, 'Cost is required')
    .refine(
      (val) => !isNaN(parseFloat(val.replace(/[^0-9.]/g, ''))) && parseFloat(val.replace(/[^0-9.]/g, '')) >= 0,
      'Cost must be a valid positive number'
    ),
  basePrice: z
    .string()
    .min(1, 'Price is required')
    .refine(
      (val) => !isNaN(parseFloat(val.replace(/[^0-9.]/g, ''))) && parseFloat(val.replace(/[^0-9.]/g, '')) >= 0,
      'Price must be a valid positive number'
    ),
  status: productStatusSchema,
  isSellable: z.boolean(),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;

// ============================================
// QUERY PARAMS SCHEMA
// ============================================

export const productListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: productStatusSchema.optional(),
  category: z.string().optional(),
  isSellable: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z
    .enum(['sku', 'name', 'category', 'baseCost', 'basePrice', 'status', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProductListParamsInput = z.infer<typeof productListParamsSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert form values to API DTO
 */
export function formToCreateDTO(values: ProductFormInput): CreateProductInput {
  return {
    sku: values.sku.toUpperCase(),
    name: values.name,
    description: values.description || null,
    shortDescription: values.shortDescription || null,
    category: values.category || null,
    rimSize: values.rimSize || null,
    tireSize: values.tireSize || null,
    weightLbs: values.weightLbs ? parseFloat(values.weightLbs) : null,
    baseCost: Math.round(parseFloat(values.baseCost.replace(/[^0-9.]/g, '')) * 100),
    basePrice: Math.round(parseFloat(values.basePrice.replace(/[^0-9.]/g, '')) * 100),
    status: values.status,
    isSellable: values.isSellable,
    imageUrl: values.imageUrl || null,
  };
}

/**
 * Convert API data to form values
 */
export function productToFormValues(product: {
  sku: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  rimSize: string | null;
  tireSize: string | null;
  weightLbs: number | null;
  baseCost: number;
  basePrice: number;
  status: 'active' | 'inactive' | 'discontinued';
  isSellable: boolean;
  imageUrl: string | null;
}): ProductFormInput {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description || '',
    shortDescription: product.shortDescription || '',
    category: product.category || '',
    rimSize: product.rimSize || '',
    tireSize: product.tireSize || '',
    weightLbs: product.weightLbs?.toString() || '',
    baseCost: (product.baseCost / 100).toFixed(2),
    basePrice: (product.basePrice / 100).toFixed(2),
    status: product.status,
    isSellable: product.isSellable,
    imageUrl: product.imageUrl || '',
  };
}
