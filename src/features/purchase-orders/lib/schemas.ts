/**
 * Purchase Orders Validation Schemas
 *
 * Zod schemas for purchase order validation.
 * Per client doc: POs always go to Galileo (Alon) - single supplier
 */

import { z } from 'zod';
import type { CreatePurchaseOrderDTO, CreatePOItemDTO, POTotals } from '../types';
import { DEFAULT_SUPPLIER } from '../types';

// ============================================
// SHARED SCHEMAS
// ============================================

export const addressSchema = z.object({
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
});

export const poItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  salesOrderItemId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().nullable(),
  quantityOrdered: z.number().int().positive('Quantity must be positive'),
  unitCode: z.string().default('EA'),
  unitPrice: z.number().int().min(0, 'Price must be non-negative'),
  taxRate: z.number().min(0).max(100).default(0),
});

// ============================================
// CREATE PO SCHEMA
// ============================================

export const createPurchaseOrderSchema = z.object({
  poDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  // Supplier is optional - defaults to Galileo/Alon per client doc
  supplierName: z.string().default(DEFAULT_SUPPLIER.name),
  supplierContact: z.string().default(DEFAULT_SUPPLIER.contact),
  salesOrderId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  currencyCode: z.string().default('USD'),
  status: z.enum(['draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'] as const).default('draft'),
  vendorAddress: addressSchema,
  shipToAddress: addressSchema,
  items: z.array(poItemSchema).min(1, 'At least one item is required'),
  vendorNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

export type CreatePOInput = z.infer<typeof createPurchaseOrderSchema>;

// ============================================
// UPDATE PO SCHEMA
// ============================================

export const updatePurchaseOrderSchema = z.object({
  poDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  currencyCode: z.string().optional(),
  vendorAddress: addressSchema.optional(),
  shipToAddress: addressSchema.optional(),
  vendorNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

export type UpdatePOInput = z.infer<typeof updatePurchaseOrderSchema>;

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate line total in cents
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number
): number {
  return Math.round(quantity * unitPrice);
}

/**
 * Calculate PO totals from items
 */
export function calculatePOTotals(
  items: Array<{
    quantityOrdered: number;
    unitPrice: number;
    taxRate: number;
  }>,
  shippingCost: number = 0
): POTotals {
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const lineTotal = calculateLineTotal(item.quantityOrdered, item.unitPrice);
    subtotal += lineTotal;
    taxTotal += Math.round(lineTotal * (item.taxRate / 100));
  }

  return {
    subtotal,
    taxTotal,
    shippingCost,
    grandTotal: subtotal + taxTotal + shippingCost,
  };
}

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const poFormSchema = z.object({
  poDate: z.string().min(1, 'PO date is required'),
  expectedDeliveryDate: z.string().optional(),
  // Supplier info is read-only (always Galileo/Alon)
  salesOrderId: z.string().optional(),
  warehouseId: z.string().optional(),
  currencyCode: z.string().default('USD'),
  vendorAddressStreet: z.string().optional(),
  vendorAddressCity: z.string().optional(),
  vendorAddressState: z.string().optional(),
  vendorAddressPostalCode: z.string().optional(),
  vendorAddressCountry: z.string().optional(),
  shipToAddressStreet: z.string().optional(),
  shipToAddressCity: z.string().optional(),
  shipToAddressState: z.string().optional(),
  shipToAddressPostalCode: z.string().optional(),
  shipToAddressCountry: z.string().optional(),
  shippingCost: z.number().min(0).default(0),
  vendorNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type POFormInput = z.infer<typeof poFormSchema>;

// ============================================
// FORM DATA CONVERSION
// ============================================

export function formToCreateDTO(
  form: POFormInput,
  items: CreatePOItemDTO[]
): CreatePurchaseOrderDTO {
  return {
    poDate: new Date(form.poDate),
    expectedDeliveryDate: form.expectedDeliveryDate
      ? new Date(form.expectedDeliveryDate)
      : null,
    // Supplier defaults to Galileo/Alon
    supplierName: DEFAULT_SUPPLIER.name,
    supplierContact: DEFAULT_SUPPLIER.contact,
    salesOrderId: form.salesOrderId || null,
    warehouseId: form.warehouseId || null,
    currencyCode: form.currencyCode || 'USD',
    status: 'draft',
    vendorAddress: {
      street: form.vendorAddressStreet || null,
      city: form.vendorAddressCity || null,
      state: form.vendorAddressState || null,
      postalCode: form.vendorAddressPostalCode || null,
      country: form.vendorAddressCountry || null,
    },
    shipToAddress: {
      street: form.shipToAddressStreet || null,
      city: form.shipToAddressCity || null,
      state: form.shipToAddressState || null,
      postalCode: form.shipToAddressPostalCode || null,
      country: form.shipToAddressCountry || null,
    },
    items,
    vendorNotes: form.vendorNotes || null,
    internalNotes: form.internalNotes || null,
  };
}
