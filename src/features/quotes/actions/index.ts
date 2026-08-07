/**
 * Quotes Server Actions
 *
 * Server actions for the Quotes module.
 * Can be called directly from Server Components or via useFormState.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { quoteService } from '../services/quote.service';
import {
  quoteFormSchema,
  createQuoteSchema,
  updateQuoteSchema,
} from '../lib/schemas';
import type {
  QuoteListParams,
  Quote,
  QuoteWithItems,
  QuoteListItem,
  QuoteStatus,
  CreateQuoteItemDTO,
} from '../types';
import { createClient } from '@/shared/lib/supabase/server';
import { db } from '@/shared/lib/supabase/database';
import { getAppUserByAuthId } from '@/shared/lib/auth';

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
 * Get paginated list of quotes
 */
export async function getQuotes(
  params: QuoteListParams = {}
): Promise<ActionResult<{
  data: QuoteListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const result = await quoteService.list(params);
  return result;
}

/**
 * Get a single quote by ID
 */
export async function getQuote(id: string): Promise<ActionResult<QuoteWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return quoteService.getById(id);
}

/**
 * Get a single quote by quote number
 */
export async function getQuoteByNumber(
  quoteNumber: string
): Promise<ActionResult<QuoteWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return quoteService.getByQuoteNumber(quoteNumber);
}

// ============================================
// CREATE/UPDATE ACTIONS
// ============================================

/**
 * Create a new quote from form data
 */
export async function createQuote(formData: FormData): Promise<ActionResult<QuoteWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Parse form data
  const rawData = {
    quoteDate: formData.get('quoteDate') as string,
    validUntil: formData.get('validUntil') as string,
    customerId: formData.get('customerId') as string,
    salesRepId: formData.get('salesRepId') as string,
    currencyId: formData.get('currencyId') as string || 'USD',
    status: (formData.get('status') as QuoteStatus) || 'draft',
    billingAddress: {
      street: formData.get('billingStreet') as string,
      city: formData.get('billingCity') as string,
      state: formData.get('billingState') as string,
      postalCode: formData.get('billingPostalCode') as string,
      country: formData.get('billingCountry') as string || 'US',
    },
    shippingAddress: {
      street: formData.get('shippingStreet') as string,
      city: formData.get('shippingCity') as string,
      state: formData.get('shippingState') as string,
      postalCode: formData.get('shippingPostalCode') as string,
      country: formData.get('shippingCountry') as string || 'US',
    },
    items: JSON.parse(formData.get('items') as string || '[]'),
    customerNotes: formData.get('customerNotes') as string,
    internalNotes: formData.get('internalNotes') as string,
    termsAndConditions: formData.get('termsAndConditions') as string,
  };

  // Validate form data
  const formValidation = quoteFormSchema.safeParse(rawData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await quoteService.createFromForm(formValidation.data, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath('/api/quotes');
  }

  return result;
}

/**
 * Create quote from JSON data (receives DTO format with Date objects)
 */
export async function createQuoteFromData(
  data: unknown
): Promise<ActionResult<QuoteWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Validate with createQuoteSchema (expects Date objects from formToCreateDTO)
  const validation = createQuoteSchema.safeParse(data);
  if (!validation.success) {
    // Map field names for better error display
    const fieldErrors: Record<string, string[]> = {};
    const flatErrors = validation.error.flatten().fieldErrors;

    Object.entries(flatErrors).forEach(([field, messages]) => {
      if (messages && messages.length > 0) {
        fieldErrors[field] = messages;
      }
    });

    return {
      success: false,
      error: 'Validation failed',
      errors: fieldErrors,
    };
  }

  const result = await quoteService.create(validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath('/api/quotes');
  }

  return result;
}

/**
 * Update an existing quote
 */
export async function updateQuote(
  id: string,
  formData: FormData
): Promise<ActionResult<Quote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Parse form data
  const rawData: Record<string, unknown> = {};

  const fields = [
    'quoteDate', 'validUntil', 'customerId', 'salesRepId',
    'currencyCode', 'customerNotes', 'internalNotes', 'termsAndConditions'
  ];

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null) {
      rawData[field] = value;
    }
  }

  // Handle addresses
  if (formData.get('billingStreet') !== null) {
    rawData.billingAddress = {
      street: formData.get('billingStreet') as string || null,
      city: formData.get('billingCity') as string || null,
      state: formData.get('billingState') as string || null,
      postalCode: formData.get('billingPostalCode') as string || null,
      country: formData.get('billingCountry') as string || null,
    };
  }

  if (formData.get('shippingStreet') !== null) {
    rawData.shippingAddress = {
      street: formData.get('shippingStreet') as string || null,
      city: formData.get('shippingCity') as string || null,
      state: formData.get('shippingState') as string || null,
      postalCode: formData.get('shippingPostalCode') as string || null,
      country: formData.get('shippingCountry') as string || null,
    };
  }

  // Convert dates
  if (rawData.quoteDate) {
    rawData.quoteDate = new Date(rawData.quoteDate as string);
  }
  if (rawData.validUntil) {
    rawData.validUntil = new Date(rawData.validUntil as string);
  }

  // Validate
  const validation = updateQuoteSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await quoteService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
    revalidatePath('/api/quotes');
  }

  return result;
}

/**
 * Update quote from JSON data
 */
export async function updateQuoteFromData(
  id: string,
  data: unknown
): Promise<ActionResult<Quote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Validate
  const validation = updateQuoteSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await quoteService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
    revalidatePath('/api/quotes');
  }

  return result;
}

/**
 * Update quote items
 */
export async function updateQuoteItems(
  quoteId: string,
  items: CreateQuoteItemDTO[]
): Promise<ActionResult<QuoteWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  const result = await quoteService.updateItems(quoteId, items, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath('/api/quotes');
  }

  return result;
}

/**
 * Soft delete a quote
 */
export async function deleteQuote(id: string): Promise<ActionResult<Quote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  const result = await quoteService.delete(id, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath('/api/quotes');
  }

  return result;
}

// ============================================
// STATUS ACTIONS
// ============================================

/**
 * Submit quote for approval (draft -> pending_approval)
 * Requires quotes.submit_for_approval permission
 */
export async function submitQuoteForApproval(id: string): Promise<ActionResult<Quote>> {
  // Check for quotes.submit_for_approval permission
  const { checkPermission } = await import('@/shared/lib/auth/check-permission');
  const { hasAccess, user: appUser, error } = await checkPermission('quotes.submit_for_approval');

  if (!hasAccess || !appUser) {
    return { success: false, error: error || 'Permission denied' };
  }

  const result = await quoteService.submitForApproval(id, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
  }

  return result;
}

/**
 * Approve a quote (pending_approval -> approved)
 * Requires quotes.approve permission
 */
export async function approveQuote(
  id: string,
  approvalNote: string | null = null
): Promise<ActionResult<Quote>> {
  // Check for quotes.approve permission
  const { checkPermission } = await import('@/shared/lib/auth/check-permission');
  const { hasAccess, user: appUser, error } = await checkPermission('quotes.approve');

  if (!hasAccess || !appUser) {
    return { success: false, error: error || 'Permission denied' };
  }

  const result = await quoteService.approveQuote(id, approvalNote, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
  }

  return result;
}

/**
 * Reject a quote approval (pending_approval -> rejected)
 * Requires quotes.approve permission
 */
export async function rejectQuoteApproval(
  id: string,
  rejectionNote: string | null = null
): Promise<ActionResult<Quote>> {
  // Check for quotes.approve permission
  const { checkPermission } = await import('@/shared/lib/auth/check-permission');
  const { hasAccess, user: appUser, error } = await checkPermission('quotes.approve');

  if (!hasAccess || !appUser) {
    return { success: false, error: error || 'Permission denied' };
  }

  const result = await quoteService.rejectQuoteApproval(id, rejectionNote, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
  }

  return result;
}

/**
 * Mark a sent quote as expired (sent -> expired)
 */
export async function expireQuote(id: string): Promise<ActionResult<Quote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  const result = await quoteService.expire(id, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
  }

  return result;
}

/**
 * Convert an approved quote to a sales order (approved -> converted)
 * Requires quotes.convert_to_order permission
 */
export async function convertQuoteToSalesOrder(
  id: string
): Promise<ActionResult<{ quote: Quote; salesOrderId: string }>> {
  // Check for quotes.convert_to_order permission
  const { checkPermission } = await import('@/shared/lib/auth/check-permission');
  const { hasAccess, user: appUser, error } = await checkPermission('quotes.convert_to_order');

  if (!hasAccess || !appUser) {
    return { success: false, error: error || 'Permission denied' };
  }

  const result = await quoteService.convertToSalesOrder(id, appUser.id);

  if (result.success) {
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
    revalidatePath('/sales-orders');
    revalidatePath('/api/quotes');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get quote counts by status
 */
export async function getQuoteStatusCounts(): Promise<ActionResult<Record<QuoteStatus, number>>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return quoteService.getStatusCounts();
}

/**
 * Get the next quote number
 */
export async function getNextQuoteNumber(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return quoteService.getNextQuoteNumber();
}

/**
 * Get customer addresses for auto-fill
 */
export async function getCustomerAddresses(customerId: string): Promise<ActionResult<{
  billing: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  shipping: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Import customer service to fetch addresses
  const { customerService } = await import('@/features/customers/services');
  return customerService.getAddresses(customerId);
}

/**
 * Find or create customer from PO extraction data
 * Used when uploading PO to auto-create customer if not found
 * Prevents duplicate customers by checking name similarity
 */
export async function findOrCreateCustomerFromPO(
  customerName: string,
  customerAddress?: string | null,
  customerCity?: string | null,
  customerState?: string | null,
  customerZip?: string | null
): Promise<ActionResult<{ customerId: string; customerName: string; created: boolean }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    // Clean the customer name for comparison
    const cleanName = customerName.trim();

    if (!cleanName) {
      return { success: false, error: 'Customer name is required' };
    }

    // Step 1: Try exact match (case-insensitive)
    const { data: exactMatch } = await db
      .from('customers')
      .select('id, name')
      .ilike('name', cleanName)
      .is('deleted_at', null)
      .single();

    if (exactMatch) {
      return {
        success: true,
        data: {
          customerId: exactMatch.id,
          customerName: exactMatch.name,
          created: false,
        },
      };
    }

    // Step 2: Try fuzzy match (contains search for first significant words)
    // Extract first 2-3 significant words for fuzzy search
    const words = cleanName.split(/[\s,]+/).filter((w) => w.length > 2).slice(0, 3);

    if (words.length > 0) {
      // Search for customers containing any of the significant words
      const { data: fuzzyMatches } = await db
        .from('customers')
        .select('id, name')
        .or(words.map((word) => `name.ilike.%${word}%`).join(','))
        .is('deleted_at', null)
        .limit(5);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Check if any match is similar enough (contains all significant words)
        for (const match of fuzzyMatches) {
          const matchNameLower = match.name.toLowerCase();
          const allWordsMatch = words.every((word) =>
            matchNameLower.includes(word.toLowerCase())
          );

          if (allWordsMatch) {
            return {
              success: true,
              data: {
                customerId: match.id,
                customerName: match.name,
                created: false,
              },
            };
          }
        }
      }
    }

    // Step 3: No match found - create new customer
    const { customerService } = await import('@/features/customers/services');

    // Use provided address fields if available, otherwise parse from string
    let address1 = customerAddress || '';
    let city = customerCity || '';
    let state = customerState || '';
    let zip = customerZip || '';

    // If separate fields not provided but address string exists, try to parse
    if (customerAddress && !customerCity && !customerState && !customerZip) {
      // Try to parse common address formats
      // "123 Main St, City, ST 12345" or "123 Main St City ST 12345"
      const addressParts = customerAddress.split(',').map((p) => p.trim());

      if (addressParts.length >= 3) {
        address1 = addressParts[0] || '';
        city = addressParts[1] || '';
        // Last part might be "ST 12345"
        const lastPart = addressParts[addressParts.length - 1] || '';
        const stateZipMatch = lastPart.match(/^([A-Z]{2})\s*(\d{5}(-\d{4})?)$/i);
        if (stateZipMatch && stateZipMatch[1] && stateZipMatch[2]) {
          state = stateZipMatch[1].toUpperCase();
          zip = stateZipMatch[2];
        } else {
          state = lastPart;
        }
      } else if (addressParts.length === 2) {
        address1 = addressParts[0] || '';
        city = addressParts[1] || '';
      } else {
        address1 = customerAddress;
      }
    }

    const createResult = await customerService.createFromForm({
      customerCode: '', // Auto-generated
      name: cleanName,
      legalName: '',
      channel: 'dealer',
      address1,
      address2: '',
      city,
      state,
      zip,
      country: 'US',
      shippingAddress1: '',
      shippingAddress2: '',
      shippingCity: '',
      shippingState: '',
      shippingZip: '',
      shippingCountry: 'US',
      useSeparateShipping: false,
      phone: '',
      email: '',
      website: '',
      taxId: '',
      taxExempt: false,
      taxExemptNumber: '',
      taxExemptExpiryAt: '',
      creditStatus: 'pending',
      creditLimit: '0',
      openBalance: '0',
      creditTerms: 'Net 30',
      preferredLocationId: '',
      defaultPaymentMethod: '',
      status: 'active',
      internalNotes: 'Auto-created from PO upload',
    }, appUser.id);

    if (createResult.success && createResult.data) {
      return {
        success: true,
        data: {
          customerId: createResult.data.id,
          customerName: createResult.data.name,
          created: true,
        },
      };
    }

    return {
      success: false,
      error: createResult.error || 'Failed to create customer',
    };
  } catch (error) {
    console.error('findOrCreateCustomerFromPO error:', error);
    return {
      success: false,
      error: 'Failed to find or create customer',
    };
  }
}

/**
 * Find or create product from PO extraction data
 * Used when uploading PO to auto-create products if not found
 * Matches by SKU or tire size, creates new product if not found
 */
export async function findOrCreateProductFromPO(
  sku: string | null,
  description: string,
  tireSize: string | null,
  unitPrice: number, // in dollars (selling price)
  baseCost: number | null = null // in dollars (cost price, optional)
): Promise<ActionResult<{
  productId: string;
  sku: string;
  name: string;
  unitPrice: number; // in cents
  created: boolean;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get app user ID (public.users.id) from auth user ID
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    // Helper function to normalize tire size for comparison
    const normalizeTireSize = (size: string): string => {
      if (!size) {
        return '';
      }
      const normalized = size.toUpperCase().trim().replace(/CW$/i, '');
      const metricPattern = /(\d+)\/(\d+)[\-\s]?(\d+)/;
      const metricMatch = normalized.match(metricPattern);
      if (metricMatch && metricMatch[1] && metricMatch[2] && metricMatch[3]) {
        return `${metricMatch[1]}/${metricMatch[2]}R${metricMatch[3]}`;
      }
      return normalized;
    };

    // Step 1: Try exact SKU match
    if (sku) {
      const { data: skuMatch } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size')
        .ilike('sku', sku)
        .is('deleted_at', null)
        .single();

      if (skuMatch) {
        return {
          success: true,
          data: {
            productId: skuMatch.id,
            sku: skuMatch.sku,
            name: skuMatch.name,
            unitPrice: skuMatch.base_price,
            created: false,
          },
        };
      }
    }

    // Step 2: Try tire size match
    if (tireSize) {
      const normalizedTireSize = normalizeTireSize(tireSize);

      const { data: products } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size')
        .is('deleted_at', null)
        .limit(20);

      if (products && products.length > 0) {
        for (const product of products) {
          if (product.tire_size) {
            const productTireSize = normalizeTireSize(product.tire_size);
            if (productTireSize === normalizedTireSize) {
              return {
                success: true,
                data: {
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  unitPrice: product.base_price,
                  created: false,
                },
              };
            }
          }
        }
      }
    }

    // Step 3: Check if a deleted product with same SKU or tire size exists - restore it
    console.log('[findOrCreateProductFromPO] Step 3: Checking for deleted product with SKU:', sku, 'or tire size:', tireSize);

    let deletedProduct = null;

    // First try by SKU
    if (sku) {
      const { data: deletedBySku } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size, deleted_at')
        .ilike('sku', sku);

      deletedProduct = deletedBySku?.find(p => p.deleted_at !== null);
      console.log('[findOrCreateProductFromPO] Found by SKU:', deletedBySku?.length, 'Deleted:', deletedProduct ? 'Yes' : 'No');
    }

    // If not found by SKU, try by tire size
    if (!deletedProduct && tireSize) {
      const normalizedSearch = normalizeTireSize(tireSize);
      console.log('[findOrCreateProductFromPO] Searching by tire size:', normalizedSearch);

      const { data: allProducts, error: fetchAllError } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size, deleted_at');

      console.log('[findOrCreateProductFromPO] Total products in DB:', allProducts?.length, 'Error:', fetchAllError);

      // Log all deleted products for debugging
      const deletedOnes = allProducts?.filter(p => p.deleted_at !== null);
      console.log('[findOrCreateProductFromPO] Deleted products:', deletedOnes?.map(p => ({
        sku: p.sku,
        tire_size: p.tire_size,
        normalized: p.tire_size ? normalizeTireSize(p.tire_size) : null
      })));

      // Find deleted product with matching tire size
      deletedProduct = allProducts?.find(p => {
        if (!p.deleted_at || !p.tire_size) {
          return false;
        }
        const productTireSize = normalizeTireSize(p.tire_size);
        const matches = productTireSize === normalizedSearch;
        if (p.deleted_at) {
          console.log('[findOrCreateProductFromPO] Comparing:', productTireSize, '===', normalizedSearch, '→', matches);
        }
        return matches;
      });
      console.log('[findOrCreateProductFromPO] Found by tire size:', deletedProduct ? 'Yes - ' + deletedProduct.sku : 'No');
    }

    if (deletedProduct) {
      // Restore the deleted product
      console.log('[findOrCreateProductFromPO] Restoring deleted product:', deletedProduct.id, deletedProduct.sku);
      const { error: restoreError } = await db
        .from('products')
        .update({
          deleted_at: null,
          status: 'active',
          base_price: Math.round(unitPrice * 100), // Update with new price
          base_cost: baseCost !== null ? Math.round(baseCost * 100) : deletedProduct.base_price,
          updated_at: new Date().toISOString(),
          updated_by: appUser.id,
        })
        .eq('id', deletedProduct.id);

      if (!restoreError) {
        console.log('[findOrCreateProductFromPO] Product restored successfully:', deletedProduct.sku);
        return {
          success: true,
          data: {
            productId: deletedProduct.id,
            sku: deletedProduct.sku,
            name: deletedProduct.name,
            unitPrice: Math.round(unitPrice * 100),
            created: false, // Restored, not created
          },
        };
      }
      // If restore failed, continue to create new product with different SKU
      console.error('[findOrCreateProductFromPO] Restore failed:', restoreError);
    }

    // Step 4: No match found - create new product
    console.log('[findOrCreateProductFromPO] Step 4: Creating new product for SKU:', sku);
    const { productService } = await import('@/features/products/services/product.service');

    // Generate a unique SKU based on tire size or description
    let newSku = '';
    if (tireSize) {
      // Use tire size as SKU base (e.g., "290-85R38")
      newSku = tireSize
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } else if (sku) {
      // Use provided SKU, normalized
      newSku = sku.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    } else {
      // Generate from description
      newSku = description
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
    }

    // Ensure SKU is unique
    const { data: existingSku } = await db
      .from('products')
      .select('sku')
      .ilike('sku', newSku)
      .is('deleted_at', null)
      .single();

    if (existingSku) {
      // Add timestamp suffix to make unique
      newSku = `${newSku}-${Date.now().toString(36).toUpperCase()}`;
    }

    // Create the product
    // baseCost is provided from user input during PO review, or defaults to 0
    const createResult = await productService.create({
      sku: newSku,
      name: description || tireSize || newSku,
      description: `Auto-created from PO upload. Original SKU: ${sku || 'N/A'}`,
      tireSize: tireSize ? normalizeTireSize(tireSize) : null,
      baseCost: baseCost !== null ? Math.round(baseCost * 100) : 0, // Convert dollars to cents, default 0
      basePrice: Math.round(unitPrice * 100), // Convert dollars to cents
      status: 'active',
      isSellable: true,
    }, appUser.id);

    if (createResult.success && createResult.data) {
      return {
        success: true,
        data: {
          productId: createResult.data.id,
          sku: createResult.data.sku,
          name: createResult.data.name,
          unitPrice: createResult.data.basePrice,
          created: true,
        },
      };
    }

    return {
      success: false,
      error: createResult.error || 'Failed to create product',
    };
  } catch (error) {
    console.error('findOrCreateProductFromPO error:', error);
    return {
      success: false,
      error: 'Failed to find or create product',
    };
  }
}

/**
 * Get product price for auto-fill
 */
export async function getProductPrice(productId: string): Promise<ActionResult<{
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const { data, error } = await db
      .from('products')
      .select('sku, name, description, base_price')
      .eq('id', productId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (error) {
      throw new Error(`Failed to fetch product: ${error.message}`);
    }

    return {
      success: true,
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description,
        unitPrice: data.base_price,
      },
    };
  } catch (error) {
    console.error('getProductPrice error:', error);
    return {
      success: false,
      error: 'Failed to fetch product price',
    };
  }
}

/**
 * Get master data for quote form
 */
export async function getQuoteMasterData(): Promise<ActionResult<{
  customers: Array<{
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
  }>;
  salesReps: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Import customer service to fetch customers
    const { customerService } = await import('@/features/customers/services');

    // Fetch all master data in parallel
    const [customersResult, productsResult, usersResult] = await Promise.all([
      customerService.getForDropdown(),
      db.from('products')
        .select('id, sku, name, description, base_price')
        .eq('status', 'active')
        .eq('is_sellable', true)
        .is('deleted_at', null)
        .order('name'),
      db.from('users')
        .select('id, first_name, last_name, email')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('first_name'),
    ]);

    if (!customersResult.success) {throw new Error(customersResult.error);}
    if (productsResult.error) {throw productsResult.error;}
    if (usersResult.error) {throw usersResult.error;}

    return {
      success: true,
      data: {
        customers: (customersResult.data || []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          email: c.email,
          phone: c.phone,
        })),
        products: (productsResult.data || []).map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          description: p.description,
          unitPrice: p.base_price,
        })),
        salesReps: (usersResult.data || []).map((u) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
        })),
      },
    };
  } catch (error) {
    console.error('getQuoteMasterData error:', error);
    return {
      success: false,
      error: 'Failed to fetch master data',
    };
  }
}

// ============================================
// PO EXTRACTION STORAGE
// ============================================

/**
 * Save PO extraction data to database
 * Called when creating a quote from PO upload
 */
export async function savePOExtraction(data: {
  quoteId?: string;
  pdfFilename?: string;
  pdfUrl?: string;
  confidence: number;
  poNumber?: string | null;
  poDate?: string | null;
  customer?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  shipTo?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  lineItems: Array<{
    sku?: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    tireSize?: string | null;
  }>;
  matchedCustomer?: {
    customerId: string | null;
    name: string;
    matched: boolean;
  };
  matchedProducts?: Array<{
    productId: string | null;
    sku: string;
    name: string;
    matched: boolean;
    quantity: number;
    unitPrice: number;
  }>;
  rawJson?: Record<string, unknown>; // Complete original extraction data
}): Promise<ActionResult<{ extractionId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    const matchedCount = data.matchedProducts?.filter(p => p.matched).length || 0;
    const unmatchedCount = data.matchedProducts?.filter(p => !p.matched).length || 0;

    const { data: extraction, error } = await db
      .from('po_extractions')
      .insert({
        quote_id: data.quoteId || null,
        pdf_filename: data.pdfFilename || null,
        pdf_url: data.pdfUrl || null,
        confidence: data.confidence,
        po_number: data.poNumber || null,
        po_date: data.poDate || null,
        customer_name: data.customer?.name || null,
        customer_address: data.customer?.address || null,
        customer_city: data.customer?.city || null,
        customer_state: data.customer?.state || null,
        customer_zip: data.customer?.zip || null,
        ship_to_name: data.shipTo?.name || null,
        ship_to_address: data.shipTo?.address || null,
        ship_to_city: data.shipTo?.city || null,
        ship_to_state: data.shipTo?.state || null,
        ship_to_zip: data.shipTo?.zip || null,
        line_items: data.lineItems,
        matched_customer: data.matchedCustomer || null,
        matched_products: data.matchedProducts || null,
        raw_json: data.rawJson || null,
        total_items: data.lineItems.length,
        matched_items: matchedCount,
        unmatched_items: unmatchedCount,
        created_by: appUser.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Save PO extraction error:', error);
      return {
        success: false,
        error: 'Failed to save extraction data',
      };
    }

    return {
      success: true,
      data: { extractionId: extraction.id },
    };
  } catch (error) {
    console.error('savePOExtraction error:', error);
    return {
      success: false,
      error: 'Failed to save extraction data',
    };
  }
}

/**
 * Update PO extraction with quote ID after quote is created
 */
export async function linkExtractionToQuote(
  extractionId: string,
  quoteId: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const { error } = await db
      .from('po_extractions')
      .update({ quote_id: quoteId })
      .eq('id', extractionId);

    if (error) {
      console.error('Link extraction to quote error:', error);
      return {
        success: false,
        error: 'Failed to link extraction to quote',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('linkExtractionToQuote error:', error);
    return {
      success: false,
      error: 'Failed to link extraction to quote',
    };
  }
}
