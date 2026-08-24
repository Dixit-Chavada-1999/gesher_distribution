/**
 * Purchase Orders Repository
 *
 * Data access layer for Purchase Orders module.
 * Per client doc: POs always go to Galileo (Alon) - single supplier
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderWithItems,
  POListItem,
  POListParams,
  CreatePurchaseOrderDTO,
  UpdatePurchaseOrderDTO,
  POStatus,
  PaginatedResult,
  SalesOrderSummary,
  LocationSummary,
} from '../types';
import { calculatePOTotals, calculateLineTotal } from '../lib/schemas';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbPurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  expected_delivery_date: string | null;
  sales_order_id: string | null;
  warehouse_id: string | null;
  currency_code: string;
  status: POStatus;
  vendor_address_street: string | null;
  vendor_address_city: string | null;
  vendor_address_state: string | null;
  vendor_address_postal_code: string | null;
  vendor_address_country: string | null;
  ship_to_address_street: string | null;
  ship_to_address_city: string | null;
  ship_to_address_state: string | null;
  ship_to_address_postal_code: string | null;
  ship_to_address_country: string | null;
  subtotal: number;
  tax_total: number;
  shipping_cost: number;
  grand_total: number;
  vendor_notes: string | null;
  internal_notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbPOItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  sales_order_item_id: string | null;
  sku: string;
  description: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_code: string;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  supplier_id: string | null;
  supplier_name: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class PurchaseOrderRepositoryImpl {
  /**
   * Find all purchase orders with pagination and filtering
   */
  async findMany(params: POListParams = {}): Promise<PaginatedResult<POListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      salesOrderId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('purchase_orders')
      .select(
        `
        id,
        po_number,
        po_date,
        expected_delivery_date,
        status,
        grand_total,
        currency_code,
        created_at
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    if (search) {
      query = query.ilike('po_number', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (salesOrderId) {
      query = query.eq('sales_order_id', salesOrderId);
    }

    if (dateFrom) {
      query = query.gte('po_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('po_date', dateTo);
    }

    const sortFieldMap: Record<string, string> = {
      poNumber: 'po_number',
      poDate: 'po_date',
      expectedDeliveryDate: 'expected_delivery_date',
      grandTotal: 'grand_total',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch purchase orders: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const poIds = (data || []).map((row) => row.id);
    const { counts: itemCounts, suppliers: itemSuppliers } = await this.getItemCountsAndSuppliers(poIds);

    return {
      data: (data || []).map((row) => this.mapToListItem(row, itemCounts, itemSuppliers)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single PO by ID with all items
   */
  async findById(id: string): Promise<PurchaseOrderWithItems | null> {
    const { data: po, error } = await db
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch purchase order: ${error.message}`);
    }

    if (!po) {return null;}

    const items = await this.findItemsByPOId(id);

    const [salesOrder, warehouse] = await Promise.all([
      po.sales_order_id ? this.getSalesOrderSummary(po.sales_order_id) : null,
      po.warehouse_id ? this.getLocationSummary(po.warehouse_id) : null,
    ]);

    return {
      ...this.mapToPurchaseOrder(po as DbPurchaseOrder),
      items,
      salesOrder: salesOrder || undefined,
      warehouse: warehouse || undefined,
    };
  }

  /**
   * Find all items for a PO
   */
  async findItemsByPOId(poId: string): Promise<PurchaseOrderItem[]> {
    const { data, error } = await db
      .from('purchase_order_items')
      .select(`*, products:product_id (item_type)`)
      .eq('purchase_order_id', poId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch PO items: ${error.message}`);
    }

    return (data || []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rowData = row as any;
      const itemType = rowData.products?.item_type as 'inventory' | 'non_inventory' | 'service' | undefined;
      return this.mapToPOItem(rowData as DbPOItem, itemType);
    });
  }

  /**
   * Get item counts and suppliers for multiple POs
   */
  private async getItemCountsAndSuppliers(poIds: string[]): Promise<{
    counts: Record<string, number>;
    suppliers: Record<string, string[]>;
  }> {
    if (poIds.length === 0) {
      return { counts: {}, suppliers: {} };
    }

    const { data, error } = await db
      .from('purchase_order_items')
      .select('purchase_order_id, supplier_name')
      .in('purchase_order_id', poIds);

    if (error) {
      throw new Error(`Failed to fetch item data: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    const suppliers: Record<string, Set<string>> = {};

    for (const row of data || []) {
      counts[row.purchase_order_id] = (counts[row.purchase_order_id] || 0) + 1;
      if (row.supplier_name) {
        if (!suppliers[row.purchase_order_id]) {
          suppliers[row.purchase_order_id] = new Set();
        }
        suppliers[row.purchase_order_id]!.add(row.supplier_name);
      }
    }

    // Convert Sets to arrays
    const suppliersArrays: Record<string, string[]> = {};
    for (const [poId, supplierSet] of Object.entries(suppliers)) {
      suppliersArrays[poId] = Array.from(supplierSet);
    }

    return { counts, suppliers: suppliersArrays };
  }

  /**
   * Get the next PO number
   */
  async getNextPONumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_po_number');

    if (error) {
      throw new Error(`Failed to generate PO number: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Create a new PO with items
   */
  async create(data: CreatePurchaseOrderDTO, userId?: string): Promise<PurchaseOrderWithItems> {
    const poNumber = await this.getNextPONumber();
    const totals = calculatePOTotals(data.items, 0);

    const { data: po, error: poError } = await db
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        po_date: data.poDate.toISOString().split('T')[0],
        expected_delivery_date: data.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        sales_order_id: data.salesOrderId || null,
        warehouse_id: data.warehouseId || null,
        currency_code: data.currencyCode || 'USD',
        status: data.status || 'draft',
        vendor_address_street: data.vendorAddress.street,
        vendor_address_city: data.vendorAddress.city,
        vendor_address_state: data.vendorAddress.state,
        vendor_address_postal_code: data.vendorAddress.postalCode,
        vendor_address_country: data.vendorAddress.country,
        ship_to_address_street: data.shipToAddress.street,
        ship_to_address_city: data.shipToAddress.city,
        ship_to_address_state: data.shipToAddress.state,
        ship_to_address_postal_code: data.shipToAddress.postalCode,
        ship_to_address_country: data.shipToAddress.country,
        subtotal: totals.subtotal,
        tax_total: totals.taxTotal,
        shipping_cost: totals.shippingCost,
        grand_total: totals.grandTotal,
        vendor_notes: data.vendorNotes || null,
        internal_notes: data.internalNotes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (poError) {
      throw new Error(`Failed to create purchase order: ${poError.message}`);
    }

    const itemsToInsert = data.items.map((item, index) => ({
      purchase_order_id: po.id,
      product_id: item.productId,
      sales_order_item_id: item.salesOrderItemId || null,
      sku: item.sku,
      description: item.description,
      quantity_ordered: item.quantityOrdered,
      quantity_received: 0,
      unit_code: item.unitCode,
      unit_price: item.unitPrice,
      tax_rate: item.taxRate,
      line_total: calculateLineTotal(item.quantityOrdered, item.unitPrice),
      sort_order: index,
      supplier_id: item.supplierId || null,
      supplier_name: item.supplierName || null,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('purchase_order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      await db.from('purchase_orders').delete().eq('id', po.id);
      throw new Error(`Failed to create PO items: ${itemsError.message}`);
    }

    return this.findById(po.id) as Promise<PurchaseOrderWithItems>;
  }

  /**
   * Update an existing PO
   */
  async update(id: string, data: UpdatePurchaseOrderDTO, userId?: string): Promise<PurchaseOrder> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.poDate !== undefined) {
      updateData.po_date = data.poDate.toISOString().split('T')[0];
    }
    if (data.expectedDeliveryDate !== undefined) {
      updateData.expected_delivery_date = data.expectedDeliveryDate?.toISOString().split('T')[0] || null;
    }
    if (data.warehouseId !== undefined) {updateData.warehouse_id = data.warehouseId;}
    if (data.currencyCode !== undefined) {updateData.currency_code = data.currencyCode;}
    if (data.vendorAddress !== undefined) {
      updateData.vendor_address_street = data.vendorAddress.street;
      updateData.vendor_address_city = data.vendorAddress.city;
      updateData.vendor_address_state = data.vendorAddress.state;
      updateData.vendor_address_postal_code = data.vendorAddress.postalCode;
      updateData.vendor_address_country = data.vendorAddress.country;
    }
    if (data.shipToAddress !== undefined) {
      updateData.ship_to_address_street = data.shipToAddress.street;
      updateData.ship_to_address_city = data.shipToAddress.city;
      updateData.ship_to_address_state = data.shipToAddress.state;
      updateData.ship_to_address_postal_code = data.shipToAddress.postalCode;
      updateData.ship_to_address_country = data.shipToAddress.country;
    }
    if (data.vendorNotes !== undefined) {updateData.vendor_notes = data.vendorNotes;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}

    // If items are provided, recalculate totals
    if (data.items && data.items.length > 0) {
      const totals = calculatePOTotals(data.items, 0);
      updateData.subtotal = totals.subtotal;
      updateData.tax_total = totals.taxTotal;
      updateData.shipping_cost = totals.shippingCost;
      updateData.grand_total = totals.grandTotal;
    }

    const { data: result, error } = await db
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update purchase order: ${error.message}`);
    }

    // Update items if provided
    if (data.items && data.items.length > 0) {
      await this.updateItems(id, data.items, userId);
    }

    return this.mapToPurchaseOrder(result as DbPurchaseOrder);
  }

  /**
   * Update items for a PO (delete and re-insert)
   */
  private async updateItems(
    poId: string,
    items: UpdatePurchaseOrderDTO['items'],
    userId?: string
  ): Promise<void> {
    if (!items || items.length === 0) {
      return;
    }

    // Delete existing items
    const { error: deleteError } = await db
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', poId);

    if (deleteError) {
      throw new Error(`Failed to delete existing PO items: ${deleteError.message}`);
    }

    // Insert new items
    const itemsToInsert = items.map((item, index) => ({
      purchase_order_id: poId,
      product_id: item.productId,
      sales_order_item_id: item.salesOrderItemId || null,
      sku: item.sku,
      description: item.description,
      quantity_ordered: item.quantityOrdered,
      quantity_received: 0,
      unit_code: item.unitCode,
      unit_price: item.unitPrice,
      tax_rate: item.taxRate,
      line_total: calculateLineTotal(item.quantityOrdered, item.unitPrice),
      sort_order: index,
      supplier_id: item.supplierId || null,
      supplier_name: item.supplierName || null,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: insertError } = await db
      .from('purchase_order_items')
      .insert(itemsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert updated PO items: ${insertError.message}`);
    }
  }

  /**
   * Update PO status
   */
  async updateStatus(id: string, status: POStatus, userId?: string): Promise<PurchaseOrder> {
    const updateData: Record<string, unknown> = {
      status,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = userId || null;
    }

    const { data: result, error } = await db
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update PO status: ${error.message}`);
    }

    return this.mapToPurchaseOrder(result as DbPurchaseOrder);
  }

  /**
   * Soft delete a PO
   */
  async softDelete(id: string, userId?: string): Promise<PurchaseOrder> {
    const { data, error } = await db
      .from('purchase_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete purchase order: ${error.message}`);
    }

    return this.mapToPurchaseOrder(data as DbPurchaseOrder);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async getSalesOrderSummary(soId: string): Promise<SalesOrderSummary | null> {
    const { data, error } = await db
      .from('sales_orders')
      .select('id, order_number, status')
      .eq('id', soId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      orderNumber: data.order_number,
      status: data.status,
    };
  }

  private async getLocationSummary(locationId: string): Promise<LocationSummary | null> {
    const { data, error } = await db
      .from('locations')
      .select('id, code, name')
      .eq('id', locationId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      code: data.code,
      name: data.name,
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToPurchaseOrder(data: DbPurchaseOrder): PurchaseOrder {
    return {
      id: data.id,
      poNumber: data.po_number,
      poDate: new Date(data.po_date),
      expectedDeliveryDate: data.expected_delivery_date ? new Date(data.expected_delivery_date) : null,
      salesOrderId: data.sales_order_id,
      warehouseId: data.warehouse_id,
      currencyCode: data.currency_code,
      status: data.status,
      vendorAddressStreet: data.vendor_address_street,
      vendorAddressCity: data.vendor_address_city,
      vendorAddressState: data.vendor_address_state,
      vendorAddressPostalCode: data.vendor_address_postal_code,
      vendorAddressCountry: data.vendor_address_country,
      shipToAddressStreet: data.ship_to_address_street,
      shipToAddressCity: data.ship_to_address_city,
      shipToAddressState: data.ship_to_address_state,
      shipToAddressPostalCode: data.ship_to_address_postal_code,
      shipToAddressCountry: data.ship_to_address_country,
      subtotal: data.subtotal,
      taxTotal: data.tax_total,
      shippingCost: data.shipping_cost,
      grandTotal: data.grand_total,
      vendorNotes: data.vendor_notes,
      internalNotes: data.internal_notes,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : null,
      cancelledBy: data.cancelled_by,
      cancellationReason: data.cancellation_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToPOItem(
    data: DbPOItem,
    itemType?: 'inventory' | 'non_inventory' | 'service'
  ): PurchaseOrderItem {
    return {
      id: data.id,
      purchaseOrderId: data.purchase_order_id,
      productId: data.product_id,
      salesOrderItemId: data.sales_order_item_id,
      sku: data.sku,
      description: data.description,
      quantityOrdered: data.quantity_ordered,
      quantityReceived: data.quantity_received,
      unitCode: data.unit_code,
      unitPrice: data.unit_price,
      taxRate: Number(data.tax_rate),
      lineTotal: data.line_total,
      sortOrder: data.sort_order,
      supplierId: data.supplier_id,
      supplierName: data.supplier_name,
      itemType,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      po_number: string;
      po_date: string;
      expected_delivery_date: string | null;
      status: POStatus;
      grand_total: number;
      currency_code: string;
      created_at: string;
    },
    itemCounts: Record<string, number>,
    itemSuppliers: Record<string, string[]>
  ): POListItem {
    return {
      id: data.id,
      poNumber: data.po_number,
      poDate: data.po_date,
      expectedDeliveryDate: data.expected_delivery_date,
      status: data.status,
      grandTotal: data.grand_total,
      currencyCode: data.currency_code,
      itemCount: itemCounts[data.id] || 0,
      createdAt: new Date(data.created_at),
      suppliers: itemSuppliers[data.id] || [],
    };
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepositoryImpl();
export type PurchaseOrderRepository = typeof purchaseOrderRepository;
