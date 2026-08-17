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
// ============================================

export async function getOperationsStats(): Promise<OperationsStats> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get ACTUAL inventory from inventory table (same source as Inventory module)
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('on_hand, allocated');

  if (invError) {
    console.error('Error fetching inventory:', invError);
    throw invError;
  }

  // Calculate available inventory: sum(on_hand - allocated) across all locations
  let availableInventoryQty = 0;

  inventory?.forEach((inv) => {
    const onHand = inv.on_hand || 0;
    const allocated = inv.allocated || 0;
    availableInventoryQty += Math.max(0, onHand - allocated);
  });

  // Count warehouse locations with inventory as "loads"
  const availableLoads = inventory?.filter(inv => (inv.on_hand || 0) > 0).length || 0;

  // Get sales orders for other stats
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
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

  const availableInventoryValue = 0;
  let committedCustomerQty = 0;
  let inTransitNext7Days = 0;
  let openLoads = 0;
  let outstandingQty = 0;
  let invoiceAmount = 0;

  // Process sales orders
  salesOrders?.forEach((so) => {
    const items = so.sales_order_items || [];
    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);
    const invoiceAmt = so.grand_total ? so.grand_total / 100 : 0;
    const isDropship = so.product_source === 'dropship';

    // Committed = confirmed/processing orders (customer has committed to buy)
    if (so.status === 'confirmed' || so.status === 'processing') {
      committedCustomerQty += totalQty;
    }

    // Outstanding = dropship orders not yet delivered
    if (isDropship && (so.status === 'pending' || so.status === 'confirmed' || so.status === 'processing')) {
      outstandingQty += totalQty;
    }

    // Open loads = dropship orders that are pending
    if (isDropship && (so.status === 'draft' || so.status === 'pending')) {
      openLoads += 1;
    }

    // Total invoice amount
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
// ============================================

export async function getCustomerCommitments(): Promise<CustomerCommitment[]> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get sales orders with customer info and items for qty calculation
  const { data: salesOrders, error } = await supabase
    .from('sales_orders')
    .select(`
      id,
      status,
      grand_total,
      requested_delivery_date,
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
// ============================================

export async function getShipmentStatusMix(): Promise<ShipmentStatusMix[]> {
  const supabase = await createClient();

  // Get shipments for status breakdown
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('load_status, total_qty')
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching shipment status mix:', error);
    throw error;
  }

  // Get actual inventory for AVAILABLE status
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('on_hand, allocated');

  if (invError) {
    console.error('Error fetching inventory for status mix:', invError);
  }

  // Calculate available inventory from inventory table
  let availableQty = 0;
  let availableLoads = 0;
  inventory?.forEach((inv) => {
    const available = Math.max(0, (inv.on_hand || 0) - (inv.allocated || 0));
    if (available > 0) {
      availableQty += available;
      availableLoads += 1;
    }
  });

  // Aggregate shipments by status
  const statusMap = new Map<string, { loads: number; qty: number }>();

  shipments?.forEach((s) => {
    const status = s.load_status || 'open';

    if (!statusMap.has(status)) {
      statusMap.set(status, { loads: 0, qty: 0 });
    }

    const current = statusMap.get(status)!;
    current.loads += 1;
    current.qty += s.total_qty || 0;
  });

  // Convert to array with proper status mapping
  const result: ShipmentStatusMix[] = [];
  statusMap.forEach((val, status) => {
    result.push({
      status: mapLoadStatus(status),
      loads: val.loads,
      qty: val.qty,
    });
  });

  // Add AVAILABLE from actual inventory (warehouse stock)
  // Override any existing AVAILABLE from shipments
  const existingAvailable = result.find(r => r.status === 'AVAILABLE');
  if (existingAvailable) {
    existingAvailable.loads = availableLoads;
    existingAvailable.qty = availableQty;
  } else {
    result.push({
      status: 'AVAILABLE',
      loads: availableLoads,
      qty: availableQty,
    });
  }

  return result;
}

// ============================================
// GET IMMEDIATE ATTENTION ITEMS
// ============================================

export async function getImmediateAttention(): Promise<ImmediateAttentionItem[]> {
  const supabase = await createClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get ALL shipments that are open or in_transit (show all for now, filter logic below)
  const { data: shipments, error } = await supabase
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
        customers(
          id,
          name
        )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching immediate attention:', error);
    throw error;
  }

  const result: ImmediateAttentionItem[] = [];

  shipments?.forEach((s) => {
    // Handle relationship data
    const salesOrderData = toOne(s.sales_orders);

    // Use eta_to_port or estimated_arrival as fallback
    const etaDate = s.eta_to_port || s.estimated_arrival;
    const etaPort = etaDate ? new Date(etaDate) : null;

    // Use customer_expected_delivery or requested_delivery_date from SO as fallback
    const customerDueDate = s.customer_expected_delivery || salesOrderData?.requested_delivery_date;
    const customerDue = customerDueDate ? new Date(customerDueDate) : null;

    // Check if this week or overdue
    const isThisWeek = etaPort ? (etaPort >= now && etaPort <= next7Days) : false;
    const isOverdue = s.is_delayed || (customerDue ? customerDue < now : false);

    // Include ALL shipments with open/in_transit status, or if this week/overdue/delayed
    const status = s.load_status as string;
    const isActive = status === 'open' || status === 'in_transit' || !status;

    if (isActive || isThisWeek || isOverdue || s.is_delayed) {
      // Load # priority: shipment_number > supplier_reference_number > N/A
      const loadNumber = s.shipment_number || s.supplier_reference_number || 'N/A';

      // PO # from sales order customer_po_number
      const poNumber = salesOrderData?.customer_po_number || 'N/A';

      result.push({
        id: s.id,
        loadNumber,
        customer: toOne(salesOrderData?.customers)?.name || 'Unknown',
        po: poNumber,
        qty: s.total_qty || 0,
        etaPort: etaDate,
        customerEtaDue: customerDueDate,
        status: mapLoadStatus(s.load_status),
        actionRequired: s.action_required || '',
        isOverdue,
        isThisWeek,
      });
    }
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
// ============================================

export async function getRimInstallationRequired(): Promise<RimInstallationItem[]> {
  const supabase = await createClient();

  // Get shipments that need rim installation (based on action_required)
  const { data: shipments, error } = await supabase
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

  if (error) {
    console.error('Error fetching rim installation items:', error);
    throw error;
  }

  // Get shipment items for SKU breakdown
  const shipmentIds = shipments?.map((s) => s.id) || [];

  const { data: items } = await supabase
    .from('shipment_items')
    .select('shipment_id, sku, quantity_shipped')
    .in('shipment_id', shipmentIds);

  // Group items by shipment
  const itemsByShipment = new Map<string, { sku: string; qty: number }[]>();
  items?.forEach((item) => {
    if (!itemsByShipment.has(item.shipment_id)) {
      itemsByShipment.set(item.shipment_id, []);
    }
    itemsByShipment.get(item.shipment_id)!.push({
      sku: item.sku,
      qty: item.quantity_shipped,
    });
  });

  const result: RimInstallationItem[] = [];

  shipments?.forEach((s, index) => {
    // Calculate SKU quantities
    const shipmentItems = itemsByShipment.get(s.id) || [];
    let sku290 = 0;
    let skuBead = 0;

    shipmentItems.forEach((item) => {
      const skuLower = item.sku.toLowerCase();
      if (skuLower.includes('290/85r38') && !skuLower.includes('bead')) {
        sku290 += item.qty;
      } else if (skuLower.includes('bead')) {
        skuBead += item.qty;
      }
    });

    result.push({
      id: s.id,
      gdc1No: index + 18, // Starting from 18 based on Jenny's sheet
      loadNumber: s.supplier_reference_number || 'N/A',
      sku290_85R38Qty: sku290,
      beadLockQty: skuBead,
      totalQty: s.total_qty || 0,
      status: mapLoadStatus(s.load_status),
      actionRequired: s.action_required || '',
      executiveNote: s.executive_notes || '',
    });
  });

  return result;
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
