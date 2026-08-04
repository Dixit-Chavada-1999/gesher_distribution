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
