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
// HELPER: Map DB load_status to ShipmentStatus
// ============================================

function mapLoadStatus(dbStatus: string | null): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    available: 'AVAILABLE',
    sold: 'SOLD',
    open: 'OPEN',
    hold: 'HOLD',
    in_transit: 'IN_TRANSIT',
    invoiced: 'INVOICED',
  };
  return statusMap[dbStatus || 'open'] || 'OPEN';
}

// ============================================
// GET OPERATIONS STATS (KPIs)
// ============================================

export async function getOperationsStats(): Promise<OperationsStats> {
  const supabase = await createClient();

  // Get all active shipments
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select(`
      id,
      load_status,
      total_qty,
      qty_delivered,
      outstanding_qty,
      supplier_invoice_amount,
      eta_to_port,
      estimated_arrival,
      is_delayed
    `)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching operations stats:', error);
    throw error;
  }

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let availableInventoryQty = 0;
  let availableLoads = 0;
  let availableInventoryValue = 0;
  let committedCustomerQty = 0;
  let inTransitNext7Days = 0;
  let openLoads = 0;
  let outstandingQty = 0;
  let invoiceAmount = 0;

  shipments?.forEach((s) => {
    // Default to 'open' if load_status is null
    const status = (s.load_status as string) || 'open';
    const qty = s.total_qty || 0;
    const outstanding = s.outstanding_qty || 0;
    const invoiceAmt = s.supplier_invoice_amount || 0;

    // Available inventory
    if (status === 'available') {
      availableInventoryQty += qty;
      availableLoads += 1;
      availableInventoryValue += invoiceAmt;
    }

    // Committed (sold)
    if (status === 'sold') {
      committedCustomerQty += qty;
    }

    // Open loads (also count shipments without load_status as open)
    if (status === 'open' || !s.load_status) {
      openLoads += 1;
    }

    // Outstanding qty
    outstandingQty += outstanding;

    // Total invoice amount
    invoiceAmount += invoiceAmt;

    // In transit next 7 days - use eta_to_port or estimated_arrival
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

export async function getSKUBreakdown(): Promise<SKUBreakdown[]> {
  const supabase = await createClient();

  // Get shipment items with SKU info
  const { data: items, error } = await supabase
    .from('shipment_items')
    .select(`
      sku,
      quantity_shipped,
      shipment:shipments!inner(
        id,
        load_status,
        deleted_at
      )
    `)
    .is('shipment.deleted_at', null);

  if (error) {
    console.error('Error fetching SKU breakdown:', error);
    throw error;
  }

  // Aggregate by SKU
  const skuMap = new Map<string, { supplier: number; gdc1: number }>();

  items?.forEach((item) => {
    const sku = item.sku || 'Unknown';
    const qty = item.quantity_shipped || 0;
    const shipment = item.shipment as { load_status: string } | null;
    const status = shipment?.load_status || 'open';

    if (!skuMap.has(sku)) {
      skuMap.set(sku, { supplier: 0, gdc1: 0 });
    }

    const current = skuMap.get(sku)!;

    // Supplier outstanding = open, in_transit
    if (status === 'open' || status === 'in_transit') {
      current.supplier += qty;
    }

    // GDC1 available = available
    if (status === 'available') {
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
      skuName: sku,
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

  // Get shipments with sales order and customer info
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select(`
      id,
      sales_order_id,
      total_qty,
      outstanding_qty,
      supplier_invoice_amount,
      eta_to_port,
      estimated_arrival,
      load_status,
      sales_orders(
        id,
        customers(
          id,
          name
        )
      )
    `)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching customer commitments:', error);
    throw error;
  }

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Aggregate by customer
  const customerMap = new Map<string, {
    id: string;
    customer: string;
    loads: number;
    outstandingQty: number;
    invoiceAmount: number;
    inTransitNext7Days: number;
  }>();

  shipments?.forEach((s) => {
    const salesOrderData = s.sales_orders as { id: string; customers: { id: string; name: string } | null } | null;
    const customer = salesOrderData?.customers;
    const customerName = customer?.name || 'Unknown';
    const customerId = customer?.id || 'unknown';

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
    current.outstandingQty += s.outstanding_qty || 0;
    current.invoiceAmount += s.supplier_invoice_amount || 0;

    // Check if in transit next 7 days - use eta_to_port or estimated_arrival
    const etaDate = s.eta_to_port || s.estimated_arrival;
    if (etaDate) {
      const eta = new Date(etaDate);
      if (eta >= now && eta <= next7Days) {
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

  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('load_status, total_qty')
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching shipment status mix:', error);
    throw error;
  }

  // Aggregate by status
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
    const salesOrderData = s.sales_orders as {
      id: string;
      order_number: string | null;
      customer_po_number: string | null;
      requested_delivery_date: string | null;
      customers: { id: string; name: string } | null;
    } | null;

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
        customer: salesOrderData?.customers?.name || 'Unknown',
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

export async function getSupplierShipmentSchedule(): Promise<{ data: ShipmentScheduleItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = await createClient();

  // Get shipments from SUPPLIER (Dropship) - source = 'supplier'
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      supplier_reference_number,
      total_qty,
      qty_delivered,
      outstanding_qty,
      eta_to_port,
      confirmed_eta,
      customer_expected_delivery,
      actual_arrival,
      estimated_arrival,
      load_status,
      action_required,
      ship_to_address_street,
      ship_to_address_city,
      ship_to_address_state,
      ship_to_address_postal_code,
      sales_order_id,
      source,
      sales_orders(
        id,
        customer_po_number,
        requested_delivery_date,
        customers(
          id,
          name
        )
      )
    `)
    .is('deleted_at', null)
    .eq('source', 'supplier')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supplier schedule:', error);
    throw error;
  }

  // Get shipment items for SKU breakdown with product names
  const shipmentIds = shipments?.map((s) => s.id) || [];

  const { data: items } = await supabase
    .from('shipment_items')
    .select(`
      shipment_id,
      sku,
      description,
      quantity_shipped,
      products(id, name)
    `)
    .in('shipment_id', shipmentIds);

  // Group items by shipment and build SKU info map
  const itemsByShipment = new Map<string, { sku: string; productName: string; qty: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = item.products as { id: string; name: string } | null;
    const productName = productData?.name || item.description || item.sku;

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

  const result: ShipmentScheduleItem[] = [];

  shipments?.forEach((s, index) => {
    // Handle relationship data - sales orders
    const salesOrderData = s.sales_orders as {
      id: string;
      customer_po_number: string | null;
      requested_delivery_date: string | null;
      customers: { id: string; name: string } | null;
    } | null;

    // Get shipment items for this shipment
    const shipmentItems = itemsByShipment.get(s.id) || [];

    // Build address
    const addressParts = [
      s.ship_to_address_street,
      s.ship_to_address_city,
      s.ship_to_address_state,
      s.ship_to_address_postal_code,
    ].filter(Boolean);

    // Load # priority: shipment_number > supplier_reference_number > N/A
    const loadNumber = s.shipment_number || s.supplier_reference_number || 'N/A';

    // PO # from sales order
    const poNumber = salesOrderData?.customer_po_number || 'N/A';

    // Use eta_to_port or estimated_arrival as fallback
    const etaDate = s.eta_to_port || s.estimated_arrival;

    // Use customer_expected_delivery or requested_delivery_date from SO as fallback
    const customerDueDate = s.customer_expected_delivery || salesOrderData?.requested_delivery_date;

    result.push({
      id: s.id,
      no: index + 1,
      loadNumber,
      items: shipmentItems,
      totalQty: s.total_qty || 0,
      customer: salesOrderData?.customers?.name || 'Unknown',
      po: poNumber,
      etaToUsPort: etaDate,
      deliveryAddress: addressParts.join(', '),
      confirmedEta: s.confirmed_eta,
      customerExpectedDelivery: customerDueDate,
      actualDeliveryDate: s.actual_arrival,
      qtyDelivered: s.qty_delivered || 0,
      outstandingQtyForPO: s.outstanding_qty || 0,
      status: mapLoadStatus(s.load_status),
      actionRequired: s.action_required || '',
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

  // Get sales order items for SKU breakdown with product names
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
      products(id, name)
    `)
    .in('sales_order_id', salesOrderIds);

  // Group items by sales order and build SKU info map
  const itemsBySalesOrder = new Map<string, { sku: string; productName: string; qty: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = item.products as { id: string; name: string } | null;
    const productName = productData?.name || item.description || item.sku;

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
    const customerData = so.customers as { id: string; name: string } | null;

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

    // Build ship window from requested_delivery_date (single date for now)
    let shipWindow: string | null = null;
    if (so.requested_delivery_date) {
      const date = new Date(so.requested_delivery_date);
      shipWindow = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    }

    result.push({
      id: so.id,
      no: index + 1,
      loadNumber: so.order_number,
      items: soItems,
      totalQty: totalQty,
      customer: customerData?.name || null,
      po: so.customer_po_number || null,
      customerShipWindow: shipWindow,
      deliveryAddress: addressParts.join(', '),
      etaToUsPort: null,  // Not applicable for warehouse orders
      customerDueDate: so.requested_delivery_date,
      actualDelivery: null,  // Will be updated when shipped
      qtyDelivered: 0,       // Will be updated when shipped
      outstandingPoQty: totalQty,  // All qty is outstanding until shipped
      invoiceNumber: null,   // Will be updated when invoiced
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,  // Convert cents to dollars
      payment50PercentDate: null,
      remaining50DueDate: null,
      status: mapSalesOrderStatus(so.status),
      actionRequired: '',
      ankurNotes: so.internal_notes || '',
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
