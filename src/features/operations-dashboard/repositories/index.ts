/**
 * Operations Dashboard Repository
 *
 * Database queries for Jenny's operations dashboard.
 * Fetches data from shipments table with the new operations fields.
 */

import { createClient } from '@/shared/lib/supabase/server';
import type {
  OperationsStats,
  SKUBreakdown,
  CustomerCommitment,
  ShipmentStatusMix,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  RimInstallationItem,
  ShipmentStatus,
  SKUColumnInfo,
} from '../types';

// ============================================
// HELPER: Unwrap an embedded to-one relation
// ============================================

/**
 * Supabase types every embedded relation as an array, even where the foreign
 * key makes it to-one and PostgREST returns a single object. Accepts either
 * shape and narrows it to the single row.
 */
type ToOne<T> = T extends readonly (infer U)[] ? U : T;

function toOne<T>(relation: T): ToOne<T> | null {
  if (Array.isArray(relation)) {
    return (relation[0] ?? null) as ToOne<T> | null;
  }
  return (relation ?? null) as ToOne<T> | null;
}

// ============================================
// HELPER: Map DB load_status to ShipmentStatus
// ============================================

function mapLoadStatus(dbStatus: string | null): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    // Common statuses
    available: 'AVAILABLE',
    open: 'OPEN',
    hold: 'HOLD',
    in_transit: 'IN_TRANSIT',
    sold: 'SOLD',
    closed: 'CLOSED',
    // Invoice/Payment statuses
    invoiced: 'INVOICED',
    not_invoiced: 'NOT_INVOICED',
    partially_paid: 'PARTIALLY_PAID',
    paid: 'PAID',
    disputed: 'DISPUTED',
    // Other statuses
    po_needed: 'PO_NEEDED',
    delivered: 'DELIVERED',
  };
  return statusMap[dbStatus || 'open'] || 'OPEN';
}

// ============================================
// GET OPERATIONS STATS (KPIs)
// Based on Jenny's Excel Master Sheet logic:
// - Available Inventory = GDC1 where status = AVAILABLE
// - Committed Customer = Supplier Schedule (with Load#) + GDC1 (status = SOLD)
// ============================================

export async function getOperationsStats(): Promise<OperationsStats> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get ALL sales orders with items for KPI calculation
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      status,
      product_source,
      grand_total,
      requested_delivery_date,
      sales_order_items(quantity)
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled');

  if (soError) {
    console.error('Error fetching sales orders for stats:', soError);
    throw soError;
  }

  // Also get shipments for in-transit tracking
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select(`
      id,
      load_status,
      eta_to_port,
      estimated_arrival
    `)
    .is('deleted_at', null);

  if (shipError) {
    console.error('Error fetching shipments for stats:', shipError);
    throw shipError;
  }

  // Initialize KPI values
  let availableInventoryQty = 0;
  let availableLoads = 0;
  let availableInventoryValue = 0;
  let committedCustomerQty = 0;
  let inTransitNext7Days = 0;
  let openLoads = 0;
  let outstandingQty = 0;
  let invoiceAmount = 0;

  // Process sales orders based on Jenny's Excel logic
  salesOrders?.forEach((so) => {
    const items = so.sales_order_items || [];
    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);
    const invoiceAmt = so.grand_total ? so.grand_total / 100 : 0;
    const isWarehouse = so.product_source === 'warehouse';  // GDC1 Inventory
    const isDropship = so.product_source === 'dropship';    // Supplier Schedule (Galileo)
    const hasLoadNumber = !!so.order_number;  // Load # not null

    // Status mapping: draft/pending = AVAILABLE, confirmed/processing = SOLD
    const isAvailable = so.status === 'draft' || so.status === 'pending';
    const isSold = so.status === 'confirmed' || so.status === 'processing';

    // ============================================
    // GDC1 INVENTORY CALCULATIONS (warehouse orders)
    // ============================================
    if (isWarehouse) {
      // Available Inventory Qty: GDC1 where status = AVAILABLE → sum total qty
      if (isAvailable) {
        availableInventoryQty += totalQty;
        availableLoads += 1;  // Count of AVAILABLE records
        availableInventoryValue += invoiceAmt;  // Sum of invoice amounts
      }

      // Committed Customer Qty from GDC1: status = SOLD → outstanding qty
      if (isSold && hasLoadNumber) {
        committedCustomerQty += totalQty;  // Outstanding qty = total qty for active orders
      }
    }

    // ============================================
    // SUPPLIER SCHEDULE CALCULATIONS (dropship/Galileo orders)
    // ============================================
    if (isDropship) {
      // Committed Customer Qty from Supplier Schedule: Load # not null → outstanding qty
      if (hasLoadNumber) {
        committedCustomerQty += totalQty;
      }

      // Outstanding = all dropship orders not yet delivered
      if (so.status === 'pending' || so.status === 'confirmed' || so.status === 'processing') {
        outstandingQty += totalQty;
      }

      // Open loads = dropship orders that are pending
      if (so.status === 'draft' || so.status === 'pending') {
        openLoads += 1;
      }
    }

    // Total invoice amount (all orders)
    invoiceAmount += invoiceAmt;

    // Check delivery due in next 7 days
    if (so.requested_delivery_date) {
      const deliveryDate = new Date(so.requested_delivery_date);
      if (deliveryDate >= now && deliveryDate <= next7Days) {
        inTransitNext7Days += 1;
      }
    }
  });

  // Count in-transit shipments arriving in next 7 days
  shipments?.forEach((s) => {
    const etaDate = s.eta_to_port || s.estimated_arrival;
    if (etaDate) {
      const eta = new Date(etaDate);
      if (eta >= now && eta <= next7Days) {
        inTransitNext7Days += 1;
      }
    }
  });

  return {
    availableInventoryQty,
    availableLoads,
    availableInventoryValue,
    committedCustomerQty,
    inTransitNext7Days,
    openLoads,
    outstandingQty,
    invoiceAmount,
  };
}

// ============================================
// GET SKU BREAKDOWN
// ============================================

/**
 * SKU Breakdown - Combined inventory across Supplier and GDC1
 *
 * Fetches from sales_order_items based on product_source:
 * - Supplier Outstanding: sales_orders where product_source = 'dropship'
 * - GDC1 Available: sales_orders where product_source = 'warehouse'
 * - Only includes inventory-type products (excludes non_inventory and service)
 */
export async function getSKUBreakdown(): Promise<SKUBreakdown[]> {
  const supabase = await createClient();

  // Get sales order items with product_source info - only inventory products
  const { data: items, error } = await supabase
    .from('sales_order_items')
    .select(`
      sku,
      quantity,
      product:products!inner(
        id,
        name,
        item_type
      ),
      sales_order:sales_orders!inner(
        id,
        product_source,
        status,
        deleted_at
      )
    `)
    .is('sales_order.deleted_at', null)
    .neq('sales_order.status', 'cancelled')
    .eq('product.item_type', 'inventory');

  if (error) {
    console.error('Error fetching SKU breakdown:', error);
    throw error;
  }

  // Aggregate by SKU - also track product name
  const skuMap = new Map<string, { supplier: number; gdc1: number; productName: string }>();

  items?.forEach((item) => {
    const sku = item.sku || 'Unknown';
    const qty = item.quantity || 0;
    const salesOrder = toOne(item.sales_order);
    const product = toOne(item.product);
    const productSource = salesOrder?.product_source || 'dropship';
    const productName = product?.name || sku;

    if (!skuMap.has(sku)) {
      skuMap.set(sku, { supplier: 0, gdc1: 0, productName });
    }

    const current = skuMap.get(sku)!;

    // Supplier outstanding = dropship orders
    if (productSource === 'dropship') {
      current.supplier += qty;
    }

    // GDC1 available = warehouse orders
    if (productSource === 'warehouse') {
      current.gdc1 += qty;
    }
  });

  // Calculate totals
  let totalCombined = 0;
  skuMap.forEach((val) => {
    totalCombined += val.supplier + val.gdc1;
  });

  // Build result
  const result: SKUBreakdown[] = [];
  skuMap.forEach((val, sku) => {
    const combined = val.supplier + val.gdc1;
    result.push({
      sku,
      skuName: val.productName,  // Use product name instead of SKU
      supplierOutstandingQty: val.supplier,
      gdc1AvailableInventory: val.gdc1,
      combinedQty: combined,
      shareOfCombined: totalCombined > 0 ? Math.round((combined / totalCombined) * 1000) / 10 : 0,
    });
  });

  // Sort by combined qty descending
  result.sort((a, b) => b.combinedQty - a.combinedQty);

  return result;
}

// ============================================
// GET CUSTOMER COMMITMENTS
// Optional productSource filter: 'dropship' for Shipment Overview, 'warehouse' for GDC1
// ============================================

export async function getCustomerCommitments(productSource?: 'dropship' | 'warehouse'): Promise<CustomerCommitment[]> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get sales orders with customer info and items for qty calculation
  let query = supabase
    .from('sales_orders')
    .select(`
      id,
      status,
      grand_total,
      requested_delivery_date,
      product_source,
      customers(
        id,
        name
      ),
      sales_order_items(
        quantity
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled');

  // Filter by product_source if specified
  if (productSource) {
    query = query.eq('product_source', productSource);
  }

  const { data: salesOrders, error } = await query;

  if (error) {
    console.error('Error fetching customer commitments:', error);
    throw error;
  }

  // Aggregate by customer
  const customerMap = new Map<string, {
    id: string;
    customer: string;
    loads: number;
    outstandingQty: number;
    invoiceAmount: number;
    inTransitNext7Days: number;
  }>();

  salesOrders?.forEach((so) => {
    const customer = toOne(so.customers);
    const customerName = customer?.name || 'Unknown';
    const customerId = customer?.id || 'unknown';

    // Calculate total qty from items
    const items = so.sales_order_items || [];
    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);

    // Invoice amount from grand_total (stored in cents)
    const invoiceAmount = so.grand_total ? so.grand_total / 100 : 0;

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        id: customerId,
        customer: customerName,
        loads: 0,
        outstandingQty: 0,
        invoiceAmount: 0,
        inTransitNext7Days: 0,
      });
    }

    const current = customerMap.get(customerId)!;
    current.loads += 1;
    current.outstandingQty += totalQty;
    current.invoiceAmount += invoiceAmount;

    // Check if delivery due in next 7 days
    if (so.requested_delivery_date) {
      const deliveryDate = new Date(so.requested_delivery_date);
      if (deliveryDate >= now && deliveryDate <= next7Days) {
        current.inTransitNext7Days += 1;
      }
    }
  });

  // Convert to array
  const result: CustomerCommitment[] = [];
  customerMap.forEach((val) => {
    result.push(val);
  });

  // Sort by loads descending
  result.sort((a, b) => b.loads - a.loads);

  return result;
}

// ============================================
// GET SHIPMENT STATUS MIX
// Based on Jenny's Excel logic - same as KPI calculations:
// - AVAILABLE: GDC1 (warehouse) where status = draft/pending
// - SOLD: GDC1 (warehouse) where status = confirmed/processing
// - OPEN: Supplier Schedule (dropship) where status = draft/pending
// - IN_TRANSIT: Any order where status = shipped
// - HOLD: From shipments table
// ============================================

export async function getShipmentStatusMix(): Promise<ShipmentStatusMix[]> {
  const supabase = await createClient();

  // Get sales orders with items for status breakdown - same logic as KPIs
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      status,
      product_source,
      sales_order_items(quantity)
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled');

  if (soError) {
    console.error('Error fetching sales orders for status mix:', soError);
    throw soError;
  }

  // Get shipments for additional statuses (HOLD, etc.)
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select('load_status, total_qty')
    .is('deleted_at', null);

  if (shipError) {
    console.error('Error fetching shipments for status mix:', shipError);
  }

  // Initialize status counters
  const statusMap = new Map<ShipmentStatus, { loads: number; qty: number }>();

  // Process sales orders - same logic as getOperationsStats()
  salesOrders?.forEach((so) => {
    const items = so.sales_order_items || [];
    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);
    const isWarehouse = so.product_source === 'warehouse';
    const isDropship = so.product_source === 'dropship';

    let displayStatus: ShipmentStatus;

    // Map SO status to display status based on product source
    if (isWarehouse) {
      // GDC1 Inventory
      if (so.status === 'draft' || so.status === 'pending') {
        displayStatus = 'AVAILABLE';
      } else if (so.status === 'confirmed' || so.status === 'processing') {
        displayStatus = 'SOLD';
      } else if (so.status === 'shipped') {
        displayStatus = 'IN_TRANSIT';
      } else if (so.status === 'delivered') {
        displayStatus = 'DELIVERED';
      } else {
        displayStatus = 'OPEN';
      }
    } else if (isDropship) {
      // Supplier Schedule (Galileo)
      if (so.status === 'draft' || so.status === 'pending') {
        displayStatus = 'OPEN';
      } else if (so.status === 'confirmed' || so.status === 'processing') {
        displayStatus = 'SOLD';
      } else if (so.status === 'shipped') {
        displayStatus = 'IN_TRANSIT';
      } else if (so.status === 'delivered') {
        displayStatus = 'DELIVERED';
      } else {
        displayStatus = 'OPEN';
      }
    } else {
      displayStatus = 'OPEN';
    }

    if (!statusMap.has(displayStatus)) {
      statusMap.set(displayStatus, { loads: 0, qty: 0 });
    }

    const current = statusMap.get(displayStatus)!;
    current.loads += 1;
    current.qty += totalQty;
  });

  // Add HOLD status from shipments table if any
  shipments?.forEach((s) => {
    if (s.load_status === 'hold') {
      if (!statusMap.has('HOLD')) {
        statusMap.set('HOLD', { loads: 0, qty: 0 });
      }
      const current = statusMap.get('HOLD')!;
      current.loads += 1;
      current.qty += s.total_qty || 0;
    }
  });

  // Convert to array
  const result: ShipmentStatusMix[] = [];
  statusMap.forEach((val, status) => {
    result.push({
      status,
      loads: val.loads,
      qty: val.qty,
    });
  });

  // Sort by qty descending
  result.sort((a, b) => b.qty - a.qty);

  return result;
}

// ============================================
// GET IMMEDIATE ATTENTION ITEMS
// Based on Jenny's workflow: Show items that need immediate attention
// - In Transit shipments arriving in next 7 days
// - Overdue orders
// - Orders with delivery due in next 7 days
// Now pulls from BOTH shipments table AND sales_orders table
// ============================================

export async function getImmediateAttention(): Promise<ImmediateAttentionItem[]> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result: ImmediateAttentionItem[] = [];

  // ============================================
  // 1. Get from SHIPMENTS table (traditional flow)
  // ============================================
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      supplier_reference_number,
      total_qty,
      eta_to_port,
      customer_expected_delivery,
      load_status,
      action_required,
      is_delayed,
      estimated_arrival,
      sales_order_id,
      sales_orders(
        id,
        order_number,
        customer_po_number,
        requested_delivery_date,
        product_source,
        customers(id, name)
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (shipError) {
    console.error('Error fetching shipments for immediate attention:', shipError);
  }

  shipments?.forEach((s) => {
    const salesOrderData = toOne(s.sales_orders);

    // Only include DROPSHIP shipments - warehouse orders shown in GDC1 Inventory
    const productSource = salesOrderData?.product_source as 'dropship' | 'warehouse';
    if (productSource === 'warehouse') {
      return; // Skip warehouse shipments
    }

    const etaDate = s.eta_to_port || s.estimated_arrival;
    const etaPort = etaDate ? new Date(etaDate) : null;
    const customerDueDate = s.customer_expected_delivery || salesOrderData?.requested_delivery_date;
    const customerDue = customerDueDate ? new Date(customerDueDate) : null;

    const isThisWeek = etaPort ? (etaPort >= now && etaPort <= next7Days) : false;
    const isOverdue = s.is_delayed || (customerDue ? customerDue < now : false);
    const status = s.load_status as string;
    const isActive = status === 'open' || status === 'in_transit' || !status;

    if (isActive || isThisWeek || isOverdue || s.is_delayed) {
      result.push({
        id: s.id,
        loadNumber: s.shipment_number || s.supplier_reference_number || 'N/A',
        customer: toOne(salesOrderData?.customers)?.name || 'Unknown',
        po: salesOrderData?.customer_po_number || 'N/A',
        qty: s.total_qty || 0,
        etaPort: etaDate,
        customerEtaDue: customerDueDate,
        status: mapLoadStatus(s.load_status),
        actionRequired: s.action_required || '',
        isOverdue,
        isThisWeek,
        productSource: productSource || 'dropship',
      });
    }
  });

  // ============================================
  // 2. Get from SALES_ORDERS table (for orders without shipments)
  // Only DROPSHIP orders - warehouse orders shown in GDC1 Inventory tab
  // ============================================
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      customer_po_number,
      status,
      product_source,
      requested_delivery_date,
      internal_notes,
      customers(id, name),
      sales_order_items(quantity)
    `)
    .is('deleted_at', null)
    .eq('product_source', 'dropship')  // Only DROPSHIP orders
    .in('status', ['pending', 'confirmed', 'processing', 'shipped'])
    .order('requested_delivery_date', { ascending: true });

  if (soError) {
    console.error('Error fetching sales orders for immediate attention:', soError);
  }

  // Track IDs we've already added from shipments
  const addedIds = new Set(result.map(r => r.id));

  salesOrders?.forEach((so) => {
    // Skip if already added from shipments
    if (addedIds.has(so.id)) { return; }

    const customerData = toOne(so.customers);
    const deliveryDate = so.requested_delivery_date ? new Date(so.requested_delivery_date) : null;

    // Check if delivery due in next 7 days or overdue
    const isThisWeek = deliveryDate ? (deliveryDate >= now && deliveryDate <= next7Days) : false;
    const isOverdue = deliveryDate ? deliveryDate < now : false;

    // Include if due this week, overdue, or in active status
    const isActive = so.status === 'pending' || so.status === 'confirmed' || so.status === 'processing';

    if (isThisWeek || isOverdue || isActive) {
      // Calculate total qty from items
      const items = so.sales_order_items || [];
      const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);

      // Map SO status to display status
      let displayStatus: ShipmentStatus = 'OPEN';
      if (so.status === 'confirmed' || so.status === 'processing') {
        displayStatus = 'SOLD';
      } else if (so.status === 'shipped') {
        displayStatus = 'IN_TRANSIT';
      }

      result.push({
        id: so.id,
        loadNumber: so.order_number || 'N/A',
        customer: customerData?.name || 'Unknown',
        po: so.customer_po_number || 'N/A',
        qty: totalQty,
        etaPort: null,
        customerEtaDue: so.requested_delivery_date,
        status: displayStatus,
        actionRequired: so.internal_notes || '',
        isOverdue,
        isThisWeek,
        productSource: so.product_source as 'dropship' | 'warehouse',
      });
    }
  });

  // Sort by: overdue first, then this week, then by date
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) { return -1; }
    if (!a.isOverdue && b.isOverdue) { return 1; }
    if (a.isThisWeek && !b.isThisWeek) { return -1; }
    if (!a.isThisWeek && b.isThisWeek) { return 1; }
    return 0;
  });

  return result;
}

// ============================================
// GET UNIQUE SKUs FOR DYNAMIC COLUMNS
// ============================================

export async function getUniqueSKUs(): Promise<string[]> {
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from('shipment_items')
    .select('sku')
    .not('sku', 'is', null);

  if (error) {
    console.error('Error fetching unique SKUs:', error);
    return [];
  }

  // Get unique SKUs and sort them
  const uniqueSkus = [...new Set(items?.map((i) => i.sku) || [])].sort();
  return uniqueSkus;
}

// ============================================
// GET SUPPLIER SHIPMENT SCHEDULE (Galileo)
// ============================================

/**
 * Supplier Shipment Schedule - Sales Orders fulfilled via Dropship
 *
 * Shows Sales Orders where product_source = 'dropship'
 * These are orders that ship directly from supplier (Galileo) to customer
 * Status mapping:
 *   - draft, pending → OPEN (order placed, not yet confirmed)
 *   - confirmed, processing → SOLD (committed to customer)
 *   - shipped → IN_TRANSIT
 *   - delivered → DELIVERED
 *   - cancelled → excluded
 */
export async function getSupplierShipmentSchedule(): Promise<{ data: ShipmentScheduleItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = await createClient();

  // Get Sales Orders where product_source = 'dropship' (Supplier/Galileo)
  const { data: salesOrders, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
      customer_po_number,
      requested_delivery_date,
      status,
      product_source,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      subtotal,
      grand_total,
      internal_notes,
      created_at,
      customers(
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .eq('product_source', 'dropship')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supplier schedule:', error);
    throw error;
  }

  // Get sales order items for SKU breakdown with product names - only inventory products
  const salesOrderIds = salesOrders?.map((s) => s.id) || [];

  const { data: items } = await supabase
    .from('sales_order_items')
    .select(`
      sales_order_id,
      sku,
      description,
      quantity,
      unit_price,
      line_total,
      products!inner(id, name, item_type)
    `)
    .in('sales_order_id', salesOrderIds)
    .eq('products.item_type', 'inventory');

  // Group items by sales order and build SKU info map
  // Also track prices per SKU per order for price columns
  const itemsBySalesOrder = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = toOne(item.products);
    const productName = productData?.name || item.description || item.sku;
    // unit_price is stored in cents, convert to dollars
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (!skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    if (!itemsBySalesOrder.has(item.sales_order_id)) {
      itemsBySalesOrder.set(item.sales_order_id, []);
    }
    itemsBySalesOrder.get(item.sales_order_id)!.push({
      sku: item.sku,
      productName,
      qty: item.quantity,
      unitPrice,
    });
  });

  // Map Sales Order status to ShipmentStatus for Supplier Schedule
  const mapSalesOrderStatusToSupplier = (status: string): ShipmentStatus => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'OPEN';       // Order placed, not yet confirmed
      case 'confirmed':
      case 'processing':
        return 'SOLD';       // Committed to customer
      case 'shipped':
        return 'IN_TRANSIT'; // On the way
      case 'delivered':
        return 'DELIVERED';  // Delivered to customer
      default:
        return 'OPEN';
    }
  };

  const result: ShipmentScheduleItem[] = [];

  salesOrders?.forEach((so, index) => {
    // Handle relationship data - customers
    const customerData = toOne(so.customers);

    // Get sales order items
    const soItems = itemsBySalesOrder.get(so.id) || [];

    // Calculate total quantity
    const totalQty = soItems.reduce((sum, item) => sum + item.qty, 0);

    // Build address
    const addressParts = [
      so.shipping_address_street,
      so.shipping_address_city,
      so.shipping_address_state,
      so.shipping_address_postal_code,
    ].filter(Boolean);

    // For dropship orders, use order_number as load number
    const loadNumber = so.order_number || 'N/A';

    // PO # from customer_po_number
    const poNumber = so.customer_po_number || 'N/A';

    result.push({
      id: so.id,
      no: index + 1,
      loadNumber,
      items: soItems,
      totalQty: totalQty,
      customer: customerData?.name || 'Unknown',
      po: poNumber,
      etaToUsPort: null,  // Will be updated when shipment info is available
      deliveryAddress: addressParts.join(', '),
      confirmedEta: null, // Will be updated when shipment info is available
      customerExpectedDelivery: so.requested_delivery_date,
      actualDeliveryDate: null, // Will be updated when delivered
      qtyDelivered: 0,          // Will be updated when delivered
      outstandingQtyForPO: totalQty, // All qty is outstanding until delivered
      invoiceNumber: null,  // Invoice #
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,  // Invoice Amount (cents to dollars)
      // Prices are dynamic per product via items[].unitPrice
      payment50PercentDate: null,  // 50% Payment Date
      remaining50DueDate: null,    // Remaining 50% Due Date
      status: mapSalesOrderStatusToSupplier(so.status),
      actionRequired: so.internal_notes || '',  // Action Required / Notes (from internal_notes)
      ankurNotes: '',  // Ankur Comments (separate field - TODO: add to DB if needed)
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  const seenSkus = new Set<string>();

  skuInfoMap.forEach((productName, sku) => {
    if (!seenSkus.has(sku)) {
      seenSkus.add(sku);
      uniqueSkus.push({ sku, productName });
    }
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GET GDC1 INVENTORY
// ============================================

/**
 * GDC1 Inventory - Sales Orders fulfilled from warehouse
 *
 * Shows Sales Orders where product_source = 'warehouse'
 * Status mapping:
 *   - draft, pending → AVAILABLE (in stock, not committed)
 *   - confirmed, processing → SOLD (committed to customer)
 *   - shipped, delivered → INVOICED
 *   - cancelled → excluded
 */
export async function getGDC1Inventory(): Promise<{ data: GDC1InventoryItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = await createClient();

  // Get Sales Orders where product_source = 'warehouse'
  const { data: salesOrders, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
      customer_po_number,
      requested_delivery_date,
      status,
      product_source,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      subtotal,
      grand_total,
      internal_notes,
      created_at,
      customers(
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .eq('product_source', 'warehouse')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching GDC1 inventory:', error);
    throw error;
  }

  // Get sales order items for SKU breakdown with product names and prices - only inventory products
  const salesOrderIds = salesOrders?.map((s) => s.id) || [];

  const { data: items } = await supabase
    .from('sales_order_items')
    .select(`
      sales_order_id,
      sku,
      description,
      quantity,
      unit_price,
      line_total,
      products!inner(id, name, item_type)
    `)
    .in('sales_order_id', salesOrderIds)
    .eq('products.item_type', 'inventory');

  // Group items by sales order and build SKU info map
  // Also track prices per SKU per order for price columns
  const itemsBySalesOrder = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = toOne(item.products);
    const productName = productData?.name || item.description || item.sku;
    // unit_price is stored in cents, convert to dollars
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (!skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    if (!itemsBySalesOrder.has(item.sales_order_id)) {
      itemsBySalesOrder.set(item.sales_order_id, []);
    }
    itemsBySalesOrder.get(item.sales_order_id)!.push({
      sku: item.sku,
      productName,
      qty: item.quantity,
      unitPrice,
    });
  });

  // Map Sales Order status to GDC1 status
  const mapSalesOrderStatus = (status: string): ShipmentStatus => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'AVAILABLE';  // In stock, not committed
      case 'confirmed':
      case 'processing':
        return 'SOLD';       // Committed to customer
      case 'shipped':
      case 'delivered':
        return 'INVOICED';   // Shipped/Delivered
      default:
        return 'OPEN';
    }
  };

  const result: GDC1InventoryItem[] = [];

  salesOrders?.forEach((so, index) => {
    // Handle relationship data - customers
    const customerData = toOne(so.customers);

    // Get sales order items
    const soItems = itemsBySalesOrder.get(so.id) || [];

    // Calculate total quantity and per-SKU quantities and prices
    const totalQty = soItems.reduce((sum, item) => sum + item.qty, 0);

    // Calculate specific SKU quantities and extract prices (for 290/85R38 and 380/85R24)
    let sku290Qty = 0;
    let sku380Qty = 0;
    let price38: number | null = null;  // Price for 38" tire (290/85R38)
    let price24: number | null = null;  // Price for 24" tire (380/85R24)

    soItems.forEach((item) => {
      const skuLower = item.sku.toLowerCase();
      if (skuLower.includes('290/85r38') || skuLower.includes('290-85r38') || skuLower.includes('38')) {
        sku290Qty += item.qty;
        // Get price for 38" tire (use first price found)
        if (price38 === null && item.unitPrice > 0) {
          price38 = item.unitPrice;
        }
      } else if (skuLower.includes('380/85r24') || skuLower.includes('380-85r24') || skuLower.includes('24')) {
        sku380Qty += item.qty;
        // Get price for 24" tire (use first price found)
        if (price24 === null && item.unitPrice > 0) {
          price24 = item.unitPrice;
        }
      }
    });

    // Build address
    const addressParts = [
      so.shipping_address_street,
      so.shipping_address_city,
      so.shipping_address_state,
      so.shipping_address_postal_code,
    ].filter(Boolean);

    result.push({
      id: so.id,
      no: index + 1,
      loadNumber: so.order_number,
      sku290Qty,   // 290/85R38 CW Qty
      sku380Qty,   // 380/85R24 CW Qty
      items: soItems,
      totalQty: totalQty,
      customer: customerData?.name || null,
      po: so.customer_po_number || null,
      etaToUsPort: null,  // ETA to US Port (from shipping info)
      deliveryAddress: addressParts.join(', '),
      confirmedEta: null,  // Confirmed ETA from shipping system
      customerExpectedDelivery: so.requested_delivery_date,  // Customer Expected Delivery
      actualDelivery: null,  // Actual Delivery Date
      qtyDelivered: 0,       // Qty Delivered
      outstandingPoQty: totalQty,  // Outstanding Qty for PO
      invoiceNumber: null,   // Invoice #
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,  // Invoice Amount (cents to dollars)
      // Prices are dynamic per product via items[].unitPrice
      payment50PercentDate: null,  // 50% Payment Date
      remaining50DueDate: null,    // Remaining 50% Due Date
      status: mapSalesOrderStatus(so.status),
      actionRequired: so.internal_notes || '',  // Action Required / Notes (from internal_notes)
      ankurNotes: '',  // Ankur Comments (separate field - TODO: add to DB if needed)
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  const seenSkus = new Set<string>();

  skuInfoMap.forEach((productName, sku) => {
    if (!seenSkus.has(sku)) {
      seenSkus.add(sku);
      uniqueSkus.push({ sku, productName });
    }
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GET RIM INSTALLATION REQUIRED
// Checks BOTH shipments.action_required AND sales_orders.internal_notes
// for items that need rim installation
// Returns dynamic SKU columns like other tables
// ============================================

export async function getRimInstallationRequired(): Promise<{ data: RimInstallationItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = await createClient();
  const result: RimInstallationItem[] = [];
  const skuInfoMap = new Map<string, string>(); // sku -> productName
  let gdc1Counter = 1;

  // ============================================
  // 1. Check SHIPMENTS table for rim installation
  // ============================================
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select(`
      id,
      supplier_reference_number,
      total_qty,
      load_status,
      action_required,
      executive_notes
    `)
    .is('deleted_at', null)
    .ilike('action_required', '%rim%installation%')
    .order('supplier_reference_number', { ascending: true });

  if (shipError) {
    console.error('Error fetching shipments for rim installation:', shipError);
  }

  // Get shipment items for SKU breakdown with product names
  const shipmentIds = shipments?.map((s) => s.id) || [];

  if (shipmentIds.length > 0) {
    const { data: shipmentItems } = await supabase
      .from('shipment_items')
      .select(`
        shipment_id,
        sku,
        quantity_shipped,
        products(id, name)
      `)
      .in('shipment_id', shipmentIds);

    // Group items by shipment
    const itemsByShipment = new Map<string, { sku: string; productName: string; qty: number }[]>();
    shipmentItems?.forEach((item) => {
      const productData = toOne(item.products);
      const productName = productData?.name || item.sku;

      // Store SKU info for column headers
      if (!skuInfoMap.has(item.sku)) {
        skuInfoMap.set(item.sku, productName);
      }

      if (!itemsByShipment.has(item.shipment_id)) {
        itemsByShipment.set(item.shipment_id, []);
      }
      itemsByShipment.get(item.shipment_id)!.push({
        sku: item.sku,
        productName,
        qty: item.quantity_shipped,
      });
    });

    shipments?.forEach((s) => {
      const items = itemsByShipment.get(s.id) || [];
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

      result.push({
        id: s.id,
        gdc1No: gdc1Counter++,
        loadNumber: s.supplier_reference_number || 'N/A',
        items,
        totalQty: s.total_qty || totalQty,
        status: mapLoadStatus(s.load_status),
        actionRequired: s.action_required || '',
        executiveNote: s.executive_notes || '',
      });
    });
  }

  // ============================================
  // 2. Check SALES_ORDERS table for rim installation
  // ============================================
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      status,
      internal_notes,
      sales_order_items(
        sku,
        quantity,
        products(id, name)
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .ilike('internal_notes', '%rim%installation%')
    .order('order_number', { ascending: true });

  if (soError) {
    console.error('Error fetching sales orders for rim installation:', soError);
  }

  // Track IDs we've already added
  const addedIds = new Set(result.map(r => r.id));

  salesOrders?.forEach((so) => {
    // Skip if already added from shipments
    if (addedIds.has(so.id)) { return; }

    const soItems = so.sales_order_items || [];
    const items: { sku: string; productName: string; qty: number }[] = [];
    let totalQty = 0;

    soItems.forEach((item: { sku: string; quantity: number; products: unknown }) => {
      const productData = toOne(item.products) as { name?: string } | null;
      const productName = productData?.name || item.sku || 'Unknown';
      const qty = item.quantity || 0;
      totalQty += qty;

      // Store SKU info for column headers
      if (item.sku && !skuInfoMap.has(item.sku)) {
        skuInfoMap.set(item.sku, productName);
      }

      items.push({
        sku: item.sku || 'Unknown',
        productName,
        qty,
      });
    });

    // Map SO status to display status
    let displayStatus: ShipmentStatus = 'OPEN';
    if (so.status === 'confirmed' || so.status === 'processing') {
      displayStatus = 'SOLD';
    } else if (so.status === 'shipped') {
      displayStatus = 'IN_TRANSIT';
    } else if (so.status === 'delivered') {
      displayStatus = 'DELIVERED';
    }

    result.push({
      id: so.id,
      gdc1No: gdc1Counter++,
      loadNumber: so.order_number || 'N/A',
      items,
      totalQty,
      status: displayStatus,
      actionRequired: so.internal_notes || '',
      executiveNote: '',
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  skuInfoMap.forEach((productName, sku) => {
    uniqueSkus.push({ sku, productName });
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GENERATE STORY IN BRIEF
// ============================================

export async function generateStoryInBrief(
  stats: OperationsStats,
  skuBreakdown: SKUBreakdown[],
  rimItems: RimInstallationItem[]
): Promise<string> {
  // Build SKU summary
  const skuParts = skuBreakdown.map((s) => `${s.combinedQty} units of ${s.skuName}`);
  const skuSummary = skuParts.join(', ');

  // Count rim installation items
  const rimCount = rimItems.length;
  const rimQty = rimItems.reduce((sum, r) => sum + r.totalQty, 0);

  let story = `Inventory reflects all GDC/MWI-owned product, including available GDC1 inventory and Galileo shipments assigned to GDC/MWI, whether open or in transit. Under this definition, total inventory is ${stats.availableInventoryQty + stats.outstandingQty} units across ${stats.availableLoads + stats.openLoads} loads, consisting of ${skuSummary}. Of this inventory, ${stats.committedCustomerQty} units are customer-committed, with ${stats.inTransitNext7Days} loads currently on the immediate watchlist.`;

  if (rimCount > 0) {
    story += `\n\n${rimCount} GDC inventory loads / ${rimQty} units need rim installation — TWS manufacturer. See RIM INSTALLATION REQUIRED section below.`;
  }

  return story;
}
