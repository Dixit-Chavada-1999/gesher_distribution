/**
 * Sales Orders Server Actions
 *
 * Server actions for the Sales Orders module.
 * Can be called directly from Server Components or via useFormState.
 *
 * Every action authenticates the caller and checks the matching
 * `orders.*` permission before touching the service layer.
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
import { db } from '@/shared/lib/supabase/database';
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

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
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
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.list(params);
  return result;
}

/**
 * Get a single sales order by ID
 */
export async function getSalesOrder(id: string): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorizeAny(['orders.view_detail', 'orders.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getById(id);
}

/**
 * Get a single sales order by order number
 */
export async function getSalesOrderByNumber(
  orderNumber: string
): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorizeAny(['orders.view_detail', 'orders.edit']);
  if (!auth.ok) {
    return auth.result;
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
  const auth = await authorize('orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

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
  const auth = await authorize('orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

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
 * Update order series only (allowed in any status)
 * Order Series is a categorization field for tracking on Operations Dashboard
 */
export async function updateSalesOrderSeries(
  id: string,
  orderSeries: string | null
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.updateOrderSeries(id, orderSeries, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
    revalidatePath('/operations');
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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.updateItems(orderId, items, auth.user.id);

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
  const auth = await authorize('orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.delete(id, auth.user.id);

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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.submit(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Confirm a pending order (pending -> confirmed)
 * Also creates a Purchase Order automatically for dropship orders
 * Note: Inventory allocation happens when Pick Ticket is created (not here)
 */
export async function confirmSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.approve');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.confirm(id, auth.user.id);

  if (result.success) {
    // Only dropship orders need a supplier PO. Warehouse orders ship from our
    // own stock, so raising a PO would put a phantom order in front of the
    // supplier — and their confirmation would create a second shipment for an
    // order the warehouse is already fulfilling.
    if (result.data?.productSource === 'dropship') {
      try {
        await createPurchaseOrderFromSalesOrder(id, auth.user.id);
      } catch (error) {
        console.error('Failed to auto-create PO:', error);
        // Don't fail the confirmation if PO creation fails
      }
    }

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/purchase-orders');
    revalidatePath('/inventory');
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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.process(id, auth.user.id);

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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.ship(id, auth.user.id);

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
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.deliver(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Cancel an order
 * If warehouse fulfillment, deallocates inventory
 */
export async function cancelSalesOrder(
  id: string,
  reason?: string
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  // Get the SO first to check if we need to deallocate
  const soResult = await salesOrderService.getById(id);
  if (!soResult.success || !soResult.data) {
    return { success: false, error: 'Sales order not found' };
  }

  const salesOrder = soResult.data;

  // Only deallocate if order was confirmed and has warehouse
  if (salesOrder.status === 'confirmed' && salesOrder.warehouseId) {
    await deallocateInventoryForSalesOrder(salesOrder, auth.user.id);
  }

  const result = await salesOrderService.cancel(id, reason, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/inventory');
  }

  return result;
}

/**
 * Helper: Deallocate inventory for cancelled Sales Order
 */
async function deallocateInventoryForSalesOrder(
  salesOrder: SalesOrderWithItems,
  userId: string
): Promise<void> {
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  const reference = {
    type: 'sales_order',
    id: salesOrder.id,
    number: salesOrder.orderNumber,
  };

  for (const item of salesOrder.items) {
    if (!item.productId) {
      continue;
    }

    try {
      await inventoryService.deallocateByProductLocation(
        item.productId,
        salesOrder.warehouseId!,
        item.quantity,
        userId,
        reference
      );
    } catch (error) {
      // Log but don't fail - best effort deallocation
      console.error(`Failed to deallocate ${item.sku}:`, error);
    }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get order counts by status
 */
export async function getSalesOrderStatusCounts(): Promise<ActionResult<Record<OrderStatus, number>>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getStatusCounts();
}

/**
 * Get the next order number
 */
export async function getNextOrderNumber(): Promise<ActionResult<string>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
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
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  // Import customer service to fetch addresses
  const { customerService } = await import('@/features/customers/services');
  return customerService.getAddresses(customerId);
}

/**
 * Get product price for auto-fill (uses price matrix based on customer channel)
 *
 * @param productId - Product ID
 * @param customerId - Customer ID (optional - if provided, uses price matrix)
 * @param quantity - Quantity (optional - for quantity-based pricing tiers)
 */
export async function getProductPrice(
  productId: string,
  customerId?: string,
  quantity: number = 1
): Promise<ActionResult<{
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  priceSource: 'matrix' | 'base';
}>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get product info
    const { data: product, error: productError } = await db
      .from('products')
      .select('sku, name, description, base_price')
      .eq('id', productId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    let unitPrice = product.base_price;
    let priceSource: 'matrix' | 'base' = 'base';

    // If customerId provided, try to get price from price matrix
    if (customerId) {
      // Get customer's channel
      const { data: customer, error: customerError } = await db
        .from('customers')
        .select('channel')
        .eq('id', customerId)
        .is('deleted_at', null)
        .single();

      if (!customerError && customer?.channel) {
        // Look up price in price matrix (RPC returns array)
        const { data: priceData, error: priceError } = await db.rpc('get_product_price', {
          p_product_id: productId,
          p_channel: customer.channel,
          p_quantity: quantity,
        });

        // priceData is an array - get first result
        const matrixPrice = Array.isArray(priceData) ? priceData[0] : priceData;

        if (!priceError && matrixPrice && matrixPrice.price > 0) {
          unitPrice = matrixPrice.price;
          priceSource = 'matrix';
        }
      }
    }

    return {
      success: true,
      data: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        unitPrice,
        priceSource,
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
    itemType: 'inventory' | 'non_inventory' | 'service';
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
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Import customer service to fetch customers
    const { customerService } = await import('@/features/customers/services');

    // Fetch all master data in parallel
    const [customersResult, productsResult, warehousesResult, usersResult] = await Promise.all([
      customerService.getForDropdown(),
      db.from('products')
        .select('id, sku, name, description, base_price, item_type')
        .eq('status', 'active')
        .eq('is_sellable', true)
        .is('deleted_at', null)
        .order('name'),
      db.from('locations')
        .select('id, location_code, name')
        .eq('is_active', true)
        .eq('location_type', 'warehouse')  // Only show actual warehouses, not drop_ship
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
          itemType: (p.item_type as 'inventory' | 'non_inventory' | 'service') || 'inventory',
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

// ============================================
// CREDIT HOLD ACTIONS
// ============================================

/**
 * Release credit hold on a sales order
 * Finance only - requires sales_orders.release_hold permission
 */
export async function releaseSalesOrderHold(
  orderId: string,
  note?: string
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('sales_orders.release_hold');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get current order
    const { data: order, error: orderError } = await db
      .from('sales_orders')
      .select('id, credit_status, order_number')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Sales order not found' };
    }

    if (order.credit_status !== 'hold') {
      return { success: false, error: 'Order is not on credit hold' };
    }

    // Update credit_status to 'ok'
    const { data: updatedOrder, error: updateError } = await db
      .from('sales_orders')
      .update({
        credit_status: 'ok',
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update pending approval event to approved
    await db
      .from('approval_events')
      .update({
        status: 'approved',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        note: note || 'Credit hold released by finance',
      })
      .eq('subject_type', 'sales_order')
      .eq('subject_id', orderId)
      .eq('type', 'credit_release')
      .eq('status', 'pending');

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);

    return {
      success: true,
      data: updatedOrder as SalesOrder,
    };
  } catch (error) {
    console.error('releaseSalesOrderHold error:', error);
    return {
      success: false,
      error: 'Failed to release credit hold',
    };
  }
}

/**
 * Get sales orders on credit hold
 */
export async function getSalesOrdersOnHold(): Promise<ActionResult<SalesOrderListItem[]>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const { data, error } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_id,
        customers!inner (name),
        order_date,
        requested_delivery_date,
        status,
        credit_status,
        product_source,
        grand_total,
        currency_code,
        order_series,
        created_at
      `)
      .eq('credit_status', 'hold')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const orders: SalesOrderListItem[] = (data || []).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      customerName: (row.customers as unknown as { name: string } | null)?.name || 'Unknown',
      orderDate: row.order_date,
      requestedDeliveryDate: row.requested_delivery_date,
      status: row.status as OrderStatus,
      creditStatus: row.credit_status as 'ok' | 'hold',
      // Matches the repository mapper, which defaults a null source to dropship
      productSource: row.product_source || 'dropship',
      grandTotal: row.grand_total,
      currencyCode: row.currency_code,
      orderSeries: row.order_series,
      itemCount: 0, // Not fetched for this list
      createdAt: new Date(row.created_at),
    }));

    return { success: true, data: orders };
  } catch (error) {
    console.error('getSalesOrdersOnHold error:', error);
    return { success: false, error: 'Failed to fetch orders on hold' };
  }
}
