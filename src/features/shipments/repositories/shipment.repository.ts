/**
 * Shipments Repository
 *
 * Data access layer for Shipments module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Shipment,
  ShipmentItem,
  ShipmentWithItems,
  ShipmentListItem,
  ShipmentListParams,
  CreateShipmentDTO,
  UpdateShipmentDTO,
  ShipmentStatus,
  PaginatedResult,
  SalesOrderSummary,
  PurchaseOrderSummary,
  LocationSummary,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbShipment {
  id: string;
  shipment_number: string;
  shipment_date: string;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  sales_order_id: string | null;
  purchase_order_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  service_type: string | null;
  from_location_id: string | null;
  ship_to_name: string | null;
  ship_to_address_street: string | null;
  ship_to_address_city: string | null;
  ship_to_address_state: string | null;
  ship_to_address_postal_code: string | null;
  ship_to_address_country: string | null;
  total_weight: number | null;
  weight_unit: string;
  total_packages: number;
  status: ShipmentStatus;
  notes: string | null;
  delivery_instructions: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbShipmentItem {
  id: string;
  shipment_id: string;
  product_id: string;
  sales_order_item_id: string | null;
  purchase_order_item_id: string | null;
  sku: string;
  description: string | null;
  quantity_shipped: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class ShipmentRepositoryImpl {
  /**
   * Find all shipments with pagination and filtering
   */
  async findMany(params: ShipmentListParams = {}): Promise<PaginatedResult<ShipmentListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      salesOrderId,
      purchaseOrderId,
      carrier,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('shipments')
      .select(
        `
        id,
        shipment_number,
        shipment_date,
        estimated_arrival,
        carrier,
        tracking_number,
        status,
        sales_order_id,
        purchase_order_id,
        created_at
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    if (search) {
      query = query.or(`shipment_number.ilike.%${search}%,tracking_number.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (salesOrderId) {
      query = query.eq('sales_order_id', salesOrderId);
    }

    if (purchaseOrderId) {
      query = query.eq('purchase_order_id', purchaseOrderId);
    }

    if (carrier) {
      query = query.ilike('carrier', `%${carrier}%`);
    }

    if (dateFrom) {
      query = query.gte('shipment_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('shipment_date', dateTo);
    }

    const sortFieldMap: Record<string, string> = {
      shipmentNumber: 'shipment_number',
      shipmentDate: 'shipment_date',
      estimatedArrival: 'estimated_arrival',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch shipments: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const shipmentIds = (data || []).map((row) => row.id);
    const [itemCounts, orderNumbers] = await Promise.all([
      this.getItemCounts(shipmentIds),
      this.getOrderNumbers(data || []),
    ]);

    return {
      data: (data || []).map((row) => this.mapToListItem(row, itemCounts, orderNumbers)),
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
   * Find a single shipment by ID with all items
   */
  async findById(id: string): Promise<ShipmentWithItems | null> {
    const { data: shipment, error } = await db
      .from('shipments')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch shipment: ${error.message}`);
    }

    if (!shipment) {return null;}

    const items = await this.findItemsByShipmentId(id);

    const [salesOrder, purchaseOrder, fromLocation] = await Promise.all([
      shipment.sales_order_id ? this.getSalesOrderSummary(shipment.sales_order_id) : null,
      shipment.purchase_order_id ? this.getPurchaseOrderSummary(shipment.purchase_order_id) : null,
      shipment.from_location_id ? this.getLocationSummary(shipment.from_location_id) : null,
    ]);

    return {
      ...this.mapToShipment(shipment as DbShipment),
      items,
      salesOrder: salesOrder || undefined,
      purchaseOrder: purchaseOrder || undefined,
      fromLocation: fromLocation || undefined,
    };
  }

  /**
   * Find all items for a shipment
   */
  async findItemsByShipmentId(shipmentId: string): Promise<ShipmentItem[]> {
    const { data, error } = await db
      .from('shipment_items')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch shipment items: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToShipmentItem(row as DbShipmentItem));
  }

  /**
   * Get item counts for multiple shipments
   */
  private async getItemCounts(shipmentIds: string[]): Promise<Record<string, number>> {
    if (shipmentIds.length === 0) {return {};}

    const { data, error } = await db
      .from('shipment_items')
      .select('shipment_id')
      .in('shipment_id', shipmentIds);

    if (error) {
      throw new Error(`Failed to fetch item counts: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.shipment_id] = (counts[row.shipment_id] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get order numbers for shipments
   */
  private async getOrderNumbers(
    shipments: Array<{ sales_order_id: string | null; purchase_order_id: string | null }>
  ): Promise<{ salesOrders: Record<string, string>; purchaseOrders: Record<string, string> }> {
    const soIds = shipments.map((s) => s.sales_order_id).filter(Boolean) as string[];
    const poIds = shipments.map((s) => s.purchase_order_id).filter(Boolean) as string[];

    const salesOrders: Record<string, string> = {};
    const purchaseOrders: Record<string, string> = {};

    if (soIds.length > 0) {
      const { data } = await db
        .from('sales_orders')
        .select('id, order_number')
        .in('id', soIds);

      for (const row of data || []) {
        salesOrders[row.id] = row.order_number;
      }
    }

    if (poIds.length > 0) {
      const { data } = await db
        .from('purchase_orders')
        .select('id, po_number')
        .in('id', poIds);

      for (const row of data || []) {
        purchaseOrders[row.id] = row.po_number;
      }
    }

    return { salesOrders, purchaseOrders };
  }

  /**
   * Get the next shipment number
   */
  async getNextShipmentNumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_shipment_number');

    if (error) {
      throw new Error(`Failed to generate shipment number: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Create a new shipment with items
   */
  async create(data: CreateShipmentDTO, userId?: string): Promise<ShipmentWithItems> {
    const shipmentNumber = await this.getNextShipmentNumber();

    const { data: shipment, error: shipmentError } = await db
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        shipment_date: data.shipmentDate.toISOString().split('T')[0],
        estimated_arrival: data.estimatedArrival?.toISOString().split('T')[0] || null,
        sales_order_id: data.salesOrderId || null,
        purchase_order_id: data.purchaseOrderId || null,
        carrier: data.carrier || null,
        tracking_number: data.trackingNumber || null,
        service_type: data.serviceType || null,
        from_location_id: data.fromLocationId || null,
        ship_to_name: data.shipToName || null,
        ship_to_address_street: data.shipToAddress.street,
        ship_to_address_city: data.shipToAddress.city,
        ship_to_address_state: data.shipToAddress.state,
        ship_to_address_postal_code: data.shipToAddress.postalCode,
        ship_to_address_country: data.shipToAddress.country,
        total_weight: data.totalWeight || null,
        weight_unit: data.weightUnit || 'lbs',
        total_packages: data.totalPackages || 1,
        status: data.status || 'pending',
        notes: data.notes || null,
        delivery_instructions: data.deliveryInstructions || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (shipmentError) {
      throw new Error(`Failed to create shipment: ${shipmentError.message}`);
    }

    const itemsToInsert = data.items.map((item, index) => ({
      shipment_id: shipment.id,
      product_id: item.productId,
      sales_order_item_id: item.salesOrderItemId || null,
      purchase_order_item_id: item.purchaseOrderItemId || null,
      sku: item.sku,
      description: item.description,
      quantity_shipped: item.quantityShipped,
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('shipment_items')
      .insert(itemsToInsert);

    if (itemsError) {
      await db.from('shipments').delete().eq('id', shipment.id);
      throw new Error(`Failed to create shipment items: ${itemsError.message}`);
    }

    return this.findById(shipment.id) as Promise<ShipmentWithItems>;
  }

  /**
   * Update an existing shipment
   */
  async update(id: string, data: UpdateShipmentDTO, userId?: string): Promise<Shipment> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.shipmentDate !== undefined) {
      updateData.shipment_date = data.shipmentDate.toISOString().split('T')[0];
    }
    if (data.estimatedArrival !== undefined) {
      updateData.estimated_arrival = data.estimatedArrival?.toISOString().split('T')[0] || null;
    }
    if (data.actualArrival !== undefined) {
      updateData.actual_arrival = data.actualArrival?.toISOString().split('T')[0] || null;
    }
    if (data.carrier !== undefined) {updateData.carrier = data.carrier;}
    if (data.trackingNumber !== undefined) {updateData.tracking_number = data.trackingNumber;}
    if (data.serviceType !== undefined) {updateData.service_type = data.serviceType;}
    if (data.fromLocationId !== undefined) {updateData.from_location_id = data.fromLocationId;}
    if (data.shipToName !== undefined) {updateData.ship_to_name = data.shipToName;}
    if (data.shipToAddress !== undefined) {
      updateData.ship_to_address_street = data.shipToAddress.street;
      updateData.ship_to_address_city = data.shipToAddress.city;
      updateData.ship_to_address_state = data.shipToAddress.state;
      updateData.ship_to_address_postal_code = data.shipToAddress.postalCode;
      updateData.ship_to_address_country = data.shipToAddress.country;
    }
    if (data.totalWeight !== undefined) {updateData.total_weight = data.totalWeight;}
    if (data.weightUnit !== undefined) {updateData.weight_unit = data.weightUnit;}
    if (data.totalPackages !== undefined) {updateData.total_packages = data.totalPackages;}
    if (data.notes !== undefined) {updateData.notes = data.notes;}
    if (data.deliveryInstructions !== undefined) {updateData.delivery_instructions = data.deliveryInstructions;}

    const { data: result, error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update shipment: ${error.message}`);
    }

    return this.mapToShipment(result as DbShipment);
  }

  /**
   * Update shipment status
   */
  async updateStatus(id: string, status: ShipmentStatus, userId?: string): Promise<Shipment> {
    const updateData: Record<string, unknown> = {
      status,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (status === 'delivered') {
      updateData.actual_arrival = new Date().toISOString().split('T')[0];
    }

    const { data: result, error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update shipment status: ${error.message}`);
    }

    return this.mapToShipment(result as DbShipment);
  }

  /**
   * Soft delete a shipment
   */
  async softDelete(id: string, userId?: string): Promise<Shipment> {
    const { data, error } = await db
      .from('shipments')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete shipment: ${error.message}`);
    }

    return this.mapToShipment(data as DbShipment);
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

  private async getPurchaseOrderSummary(poId: string): Promise<PurchaseOrderSummary | null> {
    const { data, error } = await db
      .from('purchase_orders')
      .select('id, po_number, status')
      .eq('id', poId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      poNumber: data.po_number,
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

  private mapToShipment(data: DbShipment): Shipment {
    return {
      id: data.id,
      shipmentNumber: data.shipment_number,
      shipmentDate: new Date(data.shipment_date),
      estimatedArrival: data.estimated_arrival ? new Date(data.estimated_arrival) : null,
      actualArrival: data.actual_arrival ? new Date(data.actual_arrival) : null,
      salesOrderId: data.sales_order_id,
      purchaseOrderId: data.purchase_order_id,
      carrier: data.carrier,
      trackingNumber: data.tracking_number,
      serviceType: data.service_type,
      fromLocationId: data.from_location_id,
      shipToName: data.ship_to_name,
      shipToAddressStreet: data.ship_to_address_street,
      shipToAddressCity: data.ship_to_address_city,
      shipToAddressState: data.ship_to_address_state,
      shipToAddressPostalCode: data.ship_to_address_postal_code,
      shipToAddressCountry: data.ship_to_address_country,
      totalWeight: data.total_weight,
      weightUnit: data.weight_unit,
      totalPackages: data.total_packages,
      status: data.status,
      notes: data.notes,
      deliveryInstructions: data.delivery_instructions,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToShipmentItem(data: DbShipmentItem): ShipmentItem {
    return {
      id: data.id,
      shipmentId: data.shipment_id,
      productId: data.product_id,
      salesOrderItemId: data.sales_order_item_id,
      purchaseOrderItemId: data.purchase_order_item_id,
      sku: data.sku,
      description: data.description,
      quantityShipped: data.quantity_shipped,
      sortOrder: data.sort_order,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      shipment_number: string;
      shipment_date: string;
      estimated_arrival: string | null;
      carrier: string | null;
      tracking_number: string | null;
      status: ShipmentStatus;
      sales_order_id: string | null;
      purchase_order_id: string | null;
      created_at: string;
    },
    itemCounts: Record<string, number>,
    orderNumbers: { salesOrders: Record<string, string>; purchaseOrders: Record<string, string> }
  ): ShipmentListItem {
    return {
      id: data.id,
      shipmentNumber: data.shipment_number,
      shipmentDate: data.shipment_date,
      estimatedArrival: data.estimated_arrival,
      carrier: data.carrier,
      trackingNumber: data.tracking_number,
      status: data.status,
      itemCount: itemCounts[data.id] || 0,
      salesOrderNumber: data.sales_order_id ? orderNumbers.salesOrders[data.sales_order_id] || null : null,
      purchaseOrderNumber: data.purchase_order_id ? orderNumbers.purchaseOrders[data.purchase_order_id] || null : null,
      createdAt: new Date(data.created_at),
    };
  }
}

export const shipmentRepository = new ShipmentRepositoryImpl();
export type ShipmentRepository = typeof shipmentRepository;
