/**
 * Supplier Portal Repository
 *
 * Database operations for supplier portal.
 * RLS policies ensure suppliers only see their own data.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Supplier,
  SupplierPurchaseOrder,
  SupplierPurchaseOrderItem,
  SupplierShipment,
  SupplierShipmentItem,
  SupplierDashboardStats,
  ProductionStatus,
} from '../types';

// ============================================
// SUPPLIER
// ============================================

/**
 * Get supplier by ID
 */
export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await db
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierById] Error:', error);
    return null;
  }

  return mapSupplier(data);
}

// ============================================
// PURCHASE ORDERS
// ============================================

/**
 * Get purchase orders for the supplier
 * RLS will automatically filter to supplier's POs
 */
export async function getSupplierPurchaseOrders(
  supplierId: string,
  options?: {
    status?: string;
    productionStatus?: ProductionStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: SupplierPurchaseOrder[]; count: number }> {
  let query = db
    .from('purchase_orders')
    .select('*', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .neq('status', 'draft') // Suppliers should NOT see draft POs
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.productionStatus) {
    query = query.eq('production_status', options.productionStatus);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[getSupplierPurchaseOrders] Error:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []).map(mapPurchaseOrder),
    count: count || 0,
  };
}

/**
 * Get a single purchase order by ID
 */
export async function getSupplierPurchaseOrderById(
  poId: string
): Promise<SupplierPurchaseOrder | null> {
  const { data, error } = await db
    .from('purchase_orders')
    .select(`
      *,
      sales_order:sales_orders(id, so_number),
      items:purchase_order_items(*)
    `)
    .eq('id', poId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierPurchaseOrderById] Error:', error);
    return null;
  }

  return mapPurchaseOrder(data);
}

/**
 * Get pending POs that need confirmation
 */
export async function getPendingConfirmationPOs(
  supplierId: string
): Promise<SupplierPurchaseOrder[]> {
  const { data, error } = await db
    .from('purchase_orders')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('status', 'sent')
    .is('supplier_confirmed_at', null)
    .is('supplier_rejected_at', null)
    .is('deleted_at', null)
    .order('po_date', { ascending: true });

  if (error) {
    console.error('[getPendingConfirmationPOs] Error:', error);
    return [];
  }

  return (data || []).map(mapPurchaseOrder);
}

/**
 * Confirm/Accept a purchase order
 */
export async function confirmPurchaseOrder(
  poId: string,
  userId: string,
  data: {
    expectedCompletionDate?: string;
    supplierNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('purchase_orders')
    .update({
      status: 'confirmed',
      supplier_confirmed_at: new Date().toISOString(),
      supplier_confirmed_by: userId,
      production_status: 'not_started',
      expected_completion_date: data.expectedCompletionDate || null,
      supplier_notes: data.supplierNotes || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', poId);

  if (error) {
    console.error('[confirmPurchaseOrder] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reject a purchase order
 */
export async function rejectPurchaseOrder(
  poId: string,
  userId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('purchase_orders')
    .update({
      supplier_rejected_at: new Date().toISOString(),
      supplier_rejected_by: userId,
      supplier_rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', poId);

  if (error) {
    console.error('[rejectPurchaseOrder] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update production status
 */
export async function updateProductionStatus(
  poId: string,
  userId: string,
  data: {
    productionStatus: ProductionStatus;
    expectedCompletionDate?: string;
    supplierNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('purchase_orders')
    .update({
      production_status: data.productionStatus,
      expected_completion_date: data.expectedCompletionDate || null,
      supplier_notes: data.supplierNotes || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', poId);

  if (error) {
    console.error('[updateProductionStatus] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// SHIPMENTS
// ============================================

/**
 * Get shipments for the supplier
 */
export async function getSupplierShipments(
  supplierId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: SupplierShipment[]; count: number }> {
  let query = db
    .from('shipments')
    .select('*, purchase_order:purchase_orders(id, po_number)', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[getSupplierShipments] Error:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []).map(mapShipment),
    count: count || 0,
  };
}

/**
 * Get a single shipment by ID
 */
export async function getSupplierShipmentById(
  shipmentId: string
): Promise<SupplierShipment | null> {
  const { data, error } = await db
    .from('shipments')
    .select(`
      *,
      purchase_order:purchase_orders(id, po_number),
      items:shipment_items(*)
    `)
    .eq('id', shipmentId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierShipmentById] Error:', error);
    return null;
  }

  return mapShipment(data);
}

/**
 * Update shipment details
 */
export async function updateShipment(
  shipmentId: string,
  userId: string,
  data: {
    containerNumber?: string;
    billOfLading?: string;
    vesselName?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    etd?: string;
    etaPort?: string;
    etaCustomer?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('shipments')
    .update({
      container_number: data.containerNumber || null,
      bill_of_lading: data.billOfLading || null,
      vessel_name: data.vesselName || null,
      port_of_loading: data.portOfLoading || null,
      port_of_discharge: data.portOfDischarge || null,
      etd: data.etd || null,
      eta_port: data.etaPort || null,
      eta_customer: data.etaCustomer || null,
      notes: data.notes || null,
      supplier_updated_at: new Date().toISOString(),
      supplier_updated_by: userId,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', shipmentId);

  if (error) {
    console.error('[updateShipment] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Get dashboard statistics for supplier
 */
export async function getSupplierDashboardStats(
  supplierId: string
): Promise<SupplierDashboardStats> {
  // Get PO counts (excluding drafts - suppliers shouldn't see drafts)
  const [totalResult, pendingResult, productionResult, readyResult] = await Promise.all([
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .neq('status', 'draft')
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'sent')
      .is('supplier_confirmed_at', null)
      .is('supplier_rejected_at', null)
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('production_status', 'in_production')
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('production_status', 'ready_to_ship')
      .is('deleted_at', null),
  ]);

  // Get shipment counts
  const [inTransitResult, deliveredResult] = await Promise.all([
    db
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'in_transit')
      .is('deleted_at', null),
    db
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'delivered')
      .is('deleted_at', null),
  ]);

  // Calculate delayed (POs past expected delivery date and not completed)
  const { count: delayedCount } = await db
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .lt('expected_delivery_date', new Date().toISOString().split('T')[0])
    .not('production_status', 'eq', 'shipped')
    .is('deleted_at', null);

  return {
    totalOrders: totalResult.count || 0,
    pendingConfirmation: pendingResult.count || 0,
    inProduction: productionResult.count || 0,
    readyToShip: readyResult.count || 0,
    inTransit: inTransitResult.count || 0,
    delivered: deliveredResult.count || 0,
    delayed: delayedCount || 0,
  };
}

// ============================================
// MAPPERS
// ============================================

function mapSupplier(data: Record<string, unknown>): Supplier {
  return {
    id: data.id as string,
    supplierCode: data.supplier_code as string,
    name: data.name as string,
    legalName: data.legal_name as string | null,
    primaryContactName: data.primary_contact_name as string | null,
    primaryContactEmail: data.primary_contact_email as string | null,
    primaryContactPhone: data.primary_contact_phone as string | null,
    addressStreet: data.address_street as string | null,
    addressCity: data.address_city as string | null,
    addressState: data.address_state as string | null,
    addressPostalCode: data.address_postal_code as string | null,
    addressCountry: data.address_country as string,
    paymentTerms: data.payment_terms as string | null,
    currencyCode: data.currency_code as string,
    taxId: data.tax_id as string | null,
    status: data.status as Supplier['status'],
    notes: data.notes as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function mapPurchaseOrder(data: Record<string, unknown>): SupplierPurchaseOrder {
  const salesOrder = data.sales_order as Record<string, unknown> | null;
  const items = data.items as Record<string, unknown>[] | undefined;

  return {
    id: data.id as string,
    poNumber: data.po_number as string,
    poDate: data.po_date as string,
    expectedDeliveryDate: data.expected_delivery_date as string | null,
    supplierId: data.supplier_id as string | null,
    supplierName: data.supplier_name as string | null,
    supplierContact: data.supplier_contact as string | null,
    salesOrderId: data.sales_order_id as string | null,
    warehouseId: data.warehouse_id as string | null,
    currencyCode: data.currency_code as string,
    status: data.status as SupplierPurchaseOrder['status'],
    productionStatus: (data.production_status as ProductionStatus) || 'not_started',
    supplierConfirmedAt: data.supplier_confirmed_at as string | null,
    supplierConfirmedBy: data.supplier_confirmed_by as string | null,
    supplierRejectedAt: data.supplier_rejected_at as string | null,
    supplierRejectedBy: data.supplier_rejected_by as string | null,
    supplierRejectionReason: data.supplier_rejection_reason as string | null,
    expectedCompletionDate: data.expected_completion_date as string | null,
    supplierNotes: data.supplier_notes as string | null,
    subtotal: data.subtotal as number,
    taxTotal: data.tax_total as number,
    shippingCost: data.shipping_cost as number,
    grandTotal: data.grand_total as number,
    vendorNotes: data.vendor_notes as string | null,
    internalNotes: data.internal_notes as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    salesOrder: salesOrder
      ? { id: salesOrder.id as string, soNumber: salesOrder.so_number as string }
      : undefined,
    items: items?.map(mapPurchaseOrderItem),
  };
}

function mapPurchaseOrderItem(data: Record<string, unknown>): SupplierPurchaseOrderItem {
  return {
    id: data.id as string,
    purchaseOrderId: data.purchase_order_id as string,
    productId: data.product_id as string,
    sku: data.sku as string,
    description: data.description as string | null,
    quantityOrdered: data.quantity_ordered as number,
    quantityReceived: data.quantity_received as number,
    unitCode: data.unit_code as string,
    unitPrice: data.unit_price as number,
    taxRate: data.tax_rate as number,
    lineTotal: data.line_total as number,
    sortOrder: data.sort_order as number,
  };
}

function mapShipment(data: Record<string, unknown>): SupplierShipment {
  const purchaseOrder = data.purchase_order as Record<string, unknown> | null;
  const items = data.items as Record<string, unknown>[] | undefined;

  return {
    id: data.id as string,
    shipmentNumber: data.shipment_number as string,
    shipmentDate: data.shipment_date as string,
    estimatedArrival: data.estimated_arrival as string | null,
    actualArrival: data.actual_arrival as string | null,
    salesOrderId: data.sales_order_id as string | null,
    purchaseOrderId: data.purchase_order_id as string | null,
    supplierId: data.supplier_id as string | null,
    carrier: data.carrier as string | null,
    trackingNumber: data.tracking_number as string | null,
    serviceType: data.service_type as string | null,
    status: data.status as SupplierShipment['status'],
    containerNumber: data.container_number as string | null,
    billOfLading: data.bill_of_lading as string | null,
    vesselName: data.vessel_name as string | null,
    portOfLoading: data.port_of_loading as string | null,
    portOfDischarge: data.port_of_discharge as string | null,
    etd: data.etd as string | null,
    etaPort: data.eta_port as string | null,
    etaCustomer: data.eta_customer as string | null,
    supplierUpdatedAt: data.supplier_updated_at as string | null,
    supplierUpdatedBy: data.supplier_updated_by as string | null,
    shipToName: data.ship_to_name as string | null,
    shipToAddressStreet: data.ship_to_address_street as string | null,
    shipToAddressCity: data.ship_to_address_city as string | null,
    shipToAddressState: data.ship_to_address_state as string | null,
    shipToAddressPostalCode: data.ship_to_address_postal_code as string | null,
    shipToAddressCountry: data.ship_to_address_country as string | null,
    totalWeight: data.total_weight as number | null,
    weightUnit: data.weight_unit as string,
    totalPackages: data.total_packages as number,
    notes: data.notes as string | null,
    deliveryInstructions: data.delivery_instructions as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    purchaseOrder: purchaseOrder
      ? { id: purchaseOrder.id as string, poNumber: purchaseOrder.po_number as string }
      : undefined,
    items: items?.map(mapShipmentItem),
  };
}

function mapShipmentItem(data: Record<string, unknown>): SupplierShipmentItem {
  return {
    id: data.id as string,
    shipmentId: data.shipment_id as string,
    productId: data.product_id as string,
    sku: data.sku as string,
    description: data.description as string | null,
    quantityShipped: data.quantity_shipped as number,
    sortOrder: data.sort_order as number,
  };
}
