/**
 * Sales Orders Server Actions
 *
 * Server actions for the Sales Orders module.
 * Can be called directly from Server Components or via useFormState.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { salesOrderService } from '../services/sales-order.service';
import {
  salesOrderFormSchema,
  updateSalesOrderSchema,
} from '../lib/schemas';
import type {
  SalesOrderListParams,
  SalesOrder,
  SalesOrderWithItems,
  SalesOrderListItem,
  OrderStatus,
  CreateSalesOrderItemDTO,
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
 * Get paginated list of sales orders
 */
export async function getSalesOrders(
  params: SalesOrderListParams = {}
): Promise<ActionResult<{
  data: SalesOrderListItem[];
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

  const result = await salesOrderService.list(params);
  return result;
}

/**
 * Get a single sales order by ID
 */
export async function getSalesOrder(id: string): Promise<ActionResult<SalesOrderWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return salesOrderService.getById(id);
}

/**
 * Get a single sales order by order number
 */
export async function getSalesOrderByNumber(
  orderNumber: string
): Promise<ActionResult<SalesOrderWithItems>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return salesOrderService.getByOrderNumber(orderNumber);
}

// ============================================
// CREATE/UPDATE ACTIONS
// ============================================

/**
 * Create a new sales order from form data
 */
export async function createSalesOrder(formData: FormData): Promise<ActionResult<SalesOrderWithItems>> {
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
    orderDate: formData.get('orderDate') as string,
    requestedDeliveryDate: formData.get('requestedDeliveryDate') as string,
    customerId: formData.get('customerId') as string,
    salesRepId: formData.get('salesRepId') as string,
    warehouseId: formData.get('warehouseId') as string,
    currencyId: formData.get('currencyId') as string || 'USD',
    customerPoNumber: formData.get('customerPoNumber') as string,
    status: (formData.get('status') as OrderStatus) || 'draft',
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
    shippingMethodId: formData.get('shippingMethodId') as string,
    items: JSON.parse(formData.get('items') as string || '[]'),
    customerNotes: formData.get('customerNotes') as string,
    internalNotes: formData.get('internalNotes') as string,
  };

  // Validate form data
  const formValidation = salesOrderFormSchema.safeParse(rawData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.createFromForm(formValidation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Create sales order from JSON data
 */
export async function createSalesOrderFromData(
  data: unknown
): Promise<ActionResult<SalesOrderWithItems>> {
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

  // Validate first
  const formValidation = salesOrderFormSchema.safeParse(data);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.createFromForm(formValidation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update an existing sales order
 */
export async function updateSalesOrder(
  id: string,
  formData: FormData
): Promise<ActionResult<SalesOrder>> {
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
    'orderDate', 'requestedDeliveryDate', 'customerId', 'salesRepId',
    'warehouseId', 'currencyCode', 'customerPoNumber',
    'shippingMethod', 'customerNotes', 'internalNotes'
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
  if (rawData.orderDate) {
    rawData.orderDate = new Date(rawData.orderDate as string);
  }
  if (rawData.requestedDeliveryDate) {
    rawData.requestedDeliveryDate = new Date(rawData.requestedDeliveryDate as string);
  }

  // Validate
  const validation = updateSalesOrderSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update sales order from JSON data
 */
export async function updateSalesOrderFromData(
  id: string,
  data: unknown
): Promise<ActionResult<SalesOrder>> {
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
  const validation = updateSalesOrderSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update order items
 */
export async function updateSalesOrderItems(
  orderId: string,
  items: CreateSalesOrderItemDTO[]
): Promise<ActionResult<SalesOrderWithItems>> {
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

  const result = await salesOrderService.updateItems(orderId, items, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Soft delete a sales order
 */
export async function deleteSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.delete(id, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

// ============================================
// STATUS ACTIONS
// ============================================

/**
 * Submit a draft order (draft -> pending)
 */
export async function submitSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.submit(id, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Confirm a pending order (pending -> confirmed)
 * Also creates a Purchase Order automatically
 */
export async function confirmSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.confirm(id, appUser.id);

  if (result.success) {
    // Auto-create Purchase Order from confirmed Sales Order
    try {
      await createPurchaseOrderFromSalesOrder(id, appUser.id);
    } catch (error) {
      console.error('Failed to auto-create PO:', error);
      // Don't fail the confirmation if PO creation fails
    }

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/purchase-orders');
  }

  return result;
}

/**
 * Helper: Create Purchase Order from Sales Order
 */
async function createPurchaseOrderFromSalesOrder(
  salesOrderId: string,
  userId: string
): Promise<void> {
  // Get the sales order with items
  const soResult = await salesOrderService.getById(salesOrderId);
  if (!soResult.success || !soResult.data) {
    throw new Error('Failed to get sales order');
  }

  const salesOrder = soResult.data;

  // Get product supplier info for all items
  const productIds = salesOrder.items.map(item => item.productId).filter(Boolean);

  if (productIds.length === 0) {
    return; // No products, skip PO creation
  }

  // Fetch products with their supplier_id
  const { data: products } = await db
    .from('products')
    .select('id, supplier_id, sku, name')
    .in('id', productIds);

  // Create a map of productId -> supplierId
  const productSupplierMap = new Map<string, string | null>();
  products?.forEach(p => {
    productSupplierMap.set(p.id, p.supplier_id);
  });

  // Group items by supplier
  const itemsBySupplier = new Map<string | null, typeof salesOrder.items>();

  for (const item of salesOrder.items) {
    const productSupplierId = item.productId ? productSupplierMap.get(item.productId) : undefined;
    const supplierId: string | null = productSupplierId ?? null;

    if (!itemsBySupplier.has(supplierId)) {
      itemsBySupplier.set(supplierId, []);
    }
    itemsBySupplier.get(supplierId)!.push(item);
  }

  // Get supplier details for suppliers we'll create POs for
  const supplierIds = Array.from(itemsBySupplier.keys()).filter(id => id !== null) as string[];

  const supplierMap = new Map<string, { name: string; primaryContactName: string | null }>();

  if (supplierIds.length > 0) {
    const { data: suppliers } = await db
      .from('suppliers')
      .select('id, name, primary_contact_name')
      .in('id', supplierIds);

    suppliers?.forEach(s => {
      supplierMap.set(s.id, {
        name: s.name,
        primaryContactName: s.primary_contact_name
      });
    });
  }

  // Create PO for each supplier (including null supplier for items without assigned supplier)
  for (const [supplierId, items] of itemsBySupplier) {
    const supplierInfo = supplierId ? supplierMap.get(supplierId) : null;

    // Generate PO number
    const { data: poNumber, error: poNumberError } = await db.rpc('generate_po_number');
    if (poNumberError || !poNumber) {
      console.error('Failed to generate PO number:', poNumberError);
      continue;
    }

    // Create PO items
    const poItems = items.map((item, index) => ({
      productId: item.productId || '',
      sku: item.sku,
      description: item.description || null,
      quantityOrdered: item.quantity,
      unitCode: 'EA',
      unitPrice: item.unitPrice,
      taxRate: 0,
      sortOrder: index,
    }));

    // Calculate totals
    const subtotal = poItems.reduce((sum, item) => sum + (item.unitPrice * item.quantityOrdered), 0);

    // Create the PO (supplier info is now at item level per migration 069)
    const { data: newPO, error } = await db
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: salesOrderId,
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: salesOrder.requestedDeliveryDate
          ? new Date(salesOrder.requestedDeliveryDate).toISOString().split('T')[0]
          : null,
        status: 'draft',
        currency_code: salesOrder.currencyCode || 'USD',
        warehouse_id: salesOrder.warehouseId,
        subtotal: subtotal,
        tax_total: 0,
        shipping_cost: 0,
        grand_total: subtotal,
        vendor_address_street: '',
        vendor_address_city: '',
        vendor_address_state: '',
        vendor_address_postal_code: '',
        vendor_address_country: 'USA',
        ship_to_address_street: salesOrder.shippingAddressStreet || '',
        ship_to_address_city: salesOrder.shippingAddressCity || '',
        ship_to_address_state: salesOrder.shippingAddressState || '',
        ship_to_address_postal_code: salesOrder.shippingAddressPostalCode || '',
        ship_to_address_country: salesOrder.shippingAddressCountry || 'USA',
        internal_notes: `Auto-created from SO: ${salesOrder.orderNumber}`,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create PO:', error);
      continue;
    }

    // Create PO items (supplier info is at item level per migration 068)
    if (newPO && poItems.length > 0) {
      const poItemsToInsert = poItems.map(item => ({
        purchase_order_id: newPO.id,
        product_id: item.productId || null,
        sku: item.sku,
        description: item.description,
        quantity_ordered: item.quantityOrdered,
        quantity_received: 0,
        unit_code: item.unitCode,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        line_total: item.unitPrice * item.quantityOrdered,
        sort_order: item.sortOrder,
        supplier_id: supplierId || null,
        supplier_name: supplierInfo?.name || null,
      }));

      const { error: itemsError } = await db
        .from('purchase_order_items')
        .insert(poItemsToInsert);

      if (itemsError) {
        console.error('Failed to create PO items:', itemsError);
      }
    }
  }
}

/**
 * Start processing an order (confirmed -> processing)
 */
export async function processSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.process(id, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Ship an order (processing -> shipped)
 */
export async function shipSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.ship(id, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Deliver an order (shipped -> delivered)
 */
export async function deliverSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.deliver(id, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Cancel an order
 */
export async function cancelSalesOrder(
  id: string,
  reason?: string
): Promise<ActionResult<SalesOrder>> {
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

  const result = await salesOrderService.cancel(id, reason, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get order counts by status
 */
export async function getSalesOrderStatusCounts(): Promise<ActionResult<Record<OrderStatus, number>>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return salesOrderService.getStatusCounts();
}

/**
 * Get the next order number
 */
export async function getNextOrderNumber(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return salesOrderService.getNextOrderNumber();
}

/**
 * Get customer addresses for auto-fill
 * Uses the customer module's service for addresses
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
 * Get master data for sales order form
 * Uses customer module for customer data
 */
export async function getSalesOrderMasterData(): Promise<ActionResult<{
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
  warehouses: Array<{
    id: string;
    code: string;
    name: string;
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
    const [customersResult, productsResult, warehousesResult, usersResult] = await Promise.all([
      customerService.getForDropdown(),
      db.from('products')
        .select('id, sku, name, description, base_price')
        .eq('status', 'active')
        .eq('is_sellable', true)
        .is('deleted_at', null)
        .order('name'),
      db.from('locations')
        .select('id, location_code, name')
        .eq('is_active', true)
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
    if (warehousesResult.error) {throw warehousesResult.error;}
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
        warehouses: (warehousesResult.data || []).map((w) => ({
          id: w.id,
          code: w.location_code,
          name: w.name,
        })),
        salesReps: (usersResult.data || []).map((u) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
        })),
      },
    };
  } catch (error) {
    console.error('getSalesOrderMasterData error:', error);
    return {
      success: false,
      error: 'Failed to fetch master data',
    };
  }
}
