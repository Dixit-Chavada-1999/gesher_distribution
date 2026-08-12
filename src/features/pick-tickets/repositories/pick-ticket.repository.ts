/**
 * Pick Tickets Repository
 *
 * Data access layer for Pick Tickets module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  PickTicket,
  PickTicketItem,
  PickTicketWithItems,
  PickTicketListItem,
  PickTicketListParams,
  CreatePickTicketDTO,
  UpdatePickTicketDTO,
  PickTicketStatus,
  PickTicketPriority,
  PaginatedResult,
  SalesOrderSummary,
  WarehouseSummary,
  UserSummary,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbPickTicket {
  id: string;
  pick_ticket_number: string;
  sales_order_id: string;
  warehouse_id: string;
  assigned_to: string | null;
  assigned_at: string | null;
  priority: PickTicketPriority;
  status: PickTicketStatus;
  picking_started_at: string | null;
  picking_completed_at: string | null;
  notes: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbPickTicketItem {
  id: string;
  pick_ticket_id: string;
  sales_order_item_id: string;
  product_id: string;
  sku: string;
  description: string | null;
  bin_location: string | null;
  quantity_to_pick: number;
  quantity_picked: number;
  picked_at: string | null;
  picked_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// MAPPERS
// ============================================

function mapToPickTicket(row: DbPickTicket): PickTicket {
  return {
    id: row.id,
    pickTicketNumber: row.pick_ticket_number,
    salesOrderId: row.sales_order_id,
    warehouseId: row.warehouse_id,
    assignedTo: row.assigned_to,
    assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
    priority: row.priority,
    status: row.status,
    pickingStartedAt: row.picking_started_at ? new Date(row.picking_started_at) : null,
    pickingCompletedAt: row.picking_completed_at ? new Date(row.picking_completed_at) : null,
    notes: row.notes,
    specialInstructions: row.special_instructions,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

function mapToPickTicketItem(row: DbPickTicketItem): PickTicketItem {
  return {
    id: row.id,
    pickTicketId: row.pick_ticket_id,
    salesOrderItemId: row.sales_order_item_id,
    productId: row.product_id,
    sku: row.sku,
    description: row.description,
    binLocation: row.bin_location,
    quantityToPick: row.quantity_to_pick,
    quantityPicked: row.quantity_picked,
    pickedAt: row.picked_at ? new Date(row.picked_at) : null,
    pickedBy: row.picked_by,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

// ============================================
// REPOSITORY
// ============================================

class PickTicketRepositoryImpl {
  /**
   * Find all pick tickets with pagination and filtering
   */
  async findMany(params: PickTicketListParams = {}): Promise<PaginatedResult<PickTicketListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      priority,
      warehouseId,
      salesOrderId,
      assignedTo,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('pick_tickets')
      .select(
        `
        id,
        pick_ticket_number,
        sales_order_id,
        warehouse_id,
        assigned_to,
        priority,
        status,
        created_at,
        sales_orders!inner(order_number, customers!inner(name)),
        locations!inner(name),
        users(first_name, last_name)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    if (search) {
      query = query.or(`pick_ticket_number.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    if (salesOrderId) {
      query = query.eq('sales_order_id', salesOrderId);
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const sortFieldMap: Record<string, string> = {
      pickTicketNumber: 'pick_ticket_number',
      priority: 'priority',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[PickTicketRepository.findMany] Error:', error);
      throw new Error(`Failed to fetch pick tickets: ${error.message}`);
    }

    // Get item counts for each pick ticket
    const pickTicketIds = (data || []).map((pt: Record<string, unknown>) => pt.id);
    const itemCounts = await this.getItemCounts(pickTicketIds as string[]);

    const listItems: PickTicketListItem[] = (data || []).map((row: Record<string, unknown>) => {
      const salesOrder = row.sales_orders as Record<string, unknown>;
      const customer = salesOrder?.customers as Record<string, unknown>;
      const warehouse = row.locations as Record<string, unknown>;
      const user = row.users as Record<string, unknown>;
      const counts = itemCounts[row.id as string] || { itemCount: 0, totalQuantity: 0, pickedQuantity: 0 };

      return {
        id: row.id as string,
        pickTicketNumber: row.pick_ticket_number as string,
        salesOrderId: row.sales_order_id as string,
        salesOrderNumber: salesOrder?.order_number as string,
        customerName: customer?.name as string,
        warehouseId: row.warehouse_id as string,
        warehouseName: warehouse?.name as string,
        assignedTo: row.assigned_to as string | null,
        assignedUserName: user
          ? `${user.first_name} ${user.last_name}`
          : null,
        priority: row.priority as PickTicketPriority,
        status: row.status as PickTicketStatus,
        itemCount: counts.itemCount,
        totalQuantity: counts.totalQuantity,
        pickedQuantity: counts.pickedQuantity,
        createdAt: new Date(row.created_at as string),
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: listItems,
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
   * Get item counts for pick tickets
   */
  private async getItemCounts(
    pickTicketIds: string[]
  ): Promise<Record<string, { itemCount: number; totalQuantity: number; pickedQuantity: number }>> {
    if (pickTicketIds.length === 0) {
      return {};
    }

    const { data, error } = await db
      .from('pick_ticket_items')
      .select('pick_ticket_id, quantity_to_pick, quantity_picked')
      .in('pick_ticket_id', pickTicketIds);

    if (error) {
      console.error('[PickTicketRepository.getItemCounts] Error:', error);
      return {};
    }

    const counts: Record<string, { itemCount: number; totalQuantity: number; pickedQuantity: number }> = {};

    for (const item of data || []) {
      const id = item.pick_ticket_id;
      if (!counts[id]) {
        counts[id] = { itemCount: 0, totalQuantity: 0, pickedQuantity: 0 };
      }
      counts[id].itemCount++;
      counts[id].totalQuantity += item.quantity_to_pick;
      counts[id].pickedQuantity += item.quantity_picked;
    }

    return counts;
  }

  /**
   * Find a pick ticket by ID with items
   */
  async findById(id: string): Promise<PickTicketWithItems | null> {
    const { data, error } = await db
      .from('pick_tickets')
      .select(
        `
        *,
        items:pick_ticket_items(*),
        sales_orders(id, order_number, status, customers(name)),
        locations(id, location_code, name),
        users(id, first_name, last_name, email)
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[PickTicketRepository.findById] Error:', error);
      throw new Error(`Failed to fetch pick ticket: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const salesOrder = data.sales_orders as Record<string, unknown>;
    const customer = salesOrder?.customers as Record<string, unknown>;
    const warehouse = data.locations as Record<string, unknown>;
    const user = data.users as Record<string, unknown>;

    const pickTicket = mapToPickTicket(data as unknown as DbPickTicket);
    const items = ((data.items as DbPickTicketItem[]) || []).map(mapToPickTicketItem);

    return {
      ...pickTicket,
      items,
      salesOrder: salesOrder
        ? {
            id: salesOrder.id as string,
            orderNumber: salesOrder.order_number as string,
            status: salesOrder.status as string,
            customerName: customer?.name as string,
          }
        : undefined,
      warehouse: warehouse
        ? {
            id: warehouse.id as string,
            code: warehouse.location_code as string,
            name: warehouse.name as string,
          }
        : undefined,
      assignedUser: user
        ? {
            id: user.id as string,
            firstName: user.first_name as string,
            lastName: user.last_name as string,
            email: user.email as string,
          }
        : undefined,
    };
  }

  /**
   * Find pick tickets by sales order ID
   */
  async findBySalesOrderId(salesOrderId: string): Promise<PickTicket[]> {
    const { data, error } = await db
      .from('pick_tickets')
      .select('*')
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PickTicketRepository.findBySalesOrderId] Error:', error);
      throw new Error(`Failed to fetch pick tickets: ${error.message}`);
    }

    return (data || []).map((row) => mapToPickTicket(row as DbPickTicket));
  }

  /**
   * Create a new pick ticket
   */
  async create(dto: CreatePickTicketDTO, userId?: string): Promise<PickTicket> {
    // Generate pick ticket number
    const { data: numberData, error: numberError } = await db.rpc('generate_pick_ticket_number');

    if (numberError) {
      console.error('[PickTicketRepository.create] Number generation error:', numberError);
      throw new Error(`Failed to generate pick ticket number: ${numberError.message}`);
    }

    const pickTicketNumber = numberData as string;

    // Insert pick ticket
    const { data: pickTicketData, error: pickTicketError } = await db
      .from('pick_tickets')
      .insert({
        pick_ticket_number: pickTicketNumber,
        sales_order_id: dto.salesOrderId,
        warehouse_id: dto.warehouseId,
        assigned_to: dto.assignedTo || null,
        assigned_at: dto.assignedTo ? new Date().toISOString() : null,
        priority: dto.priority || 'normal',
        status: dto.assignedTo ? 'assigned' : 'pending',
        notes: dto.notes || null,
        special_instructions: dto.specialInstructions || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (pickTicketError) {
      console.error('[PickTicketRepository.create] Error:', pickTicketError);
      throw new Error(`Failed to create pick ticket: ${pickTicketError.message}`);
    }

    // Insert items
    if (dto.items.length > 0) {
      const itemsToInsert = dto.items.map((item, index) => ({
        pick_ticket_id: pickTicketData.id,
        sales_order_item_id: item.salesOrderItemId,
        product_id: item.productId,
        sku: item.sku,
        description: item.description,
        bin_location: item.binLocation || null,
        quantity_to_pick: item.quantityToPick,
        quantity_picked: 0,
        sort_order: index,
        created_by: userId || null,
        updated_by: userId || null,
      }));

      const { error: itemsError } = await db.from('pick_ticket_items').insert(itemsToInsert);

      if (itemsError) {
        console.error('[PickTicketRepository.create] Items error:', itemsError);
        // Rollback - delete the pick ticket
        await db.from('pick_tickets').delete().eq('id', pickTicketData.id);
        throw new Error(`Failed to create pick ticket items: ${itemsError.message}`);
      }
    }

    return mapToPickTicket(pickTicketData as DbPickTicket);
  }

  /**
   * Update a pick ticket
   */
  async update(id: string, dto: UpdatePickTicketDTO, userId?: string): Promise<PickTicket> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (dto.assignedTo !== undefined) {
      updateData.assigned_to = dto.assignedTo;
      if (dto.assignedTo) {
        updateData.assigned_at = new Date().toISOString();
      }
    }

    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.specialInstructions !== undefined) {
      updateData.special_instructions = dto.specialInstructions;
    }

    const { data, error } = await db
      .from('pick_tickets')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PickTicketRepository.update] Error:', error);
      throw new Error(`Failed to update pick ticket: ${error.message}`);
    }

    return mapToPickTicket(data as DbPickTicket);
  }

  /**
   * Update pick ticket status
   */
  async updateStatus(id: string, status: PickTicketStatus, userId?: string): Promise<PickTicket> {
    const updateData: Record<string, unknown> = {
      status,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    // Set timestamps based on status
    if (status === 'picking') {
      updateData.picking_started_at = new Date().toISOString();
    } else if (status === 'picked') {
      updateData.picking_completed_at = new Date().toISOString();
    }

    const { data, error } = await db
      .from('pick_tickets')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PickTicketRepository.updateStatus] Error:', error);
      throw new Error(`Failed to update pick ticket status: ${error.message}`);
    }

    return mapToPickTicket(data as DbPickTicket);
  }

  /**
   * Update a pick ticket item (mark as picked)
   */
  async updateItem(
    itemId: string,
    quantityPicked: number,
    userId?: string
  ): Promise<PickTicketItem> {
    const { data, error } = await db
      .from('pick_ticket_items')
      .update({
        quantity_picked: quantityPicked,
        picked_at: new Date().toISOString(),
        picked_by: userId || null,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('[PickTicketRepository.updateItem] Error:', error);
      throw new Error(`Failed to update pick ticket item: ${error.message}`);
    }

    return mapToPickTicketItem(data as DbPickTicketItem);
  }

  /**
   * Soft delete a pick ticket
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('pick_tickets')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('[PickTicketRepository.delete] Error:', error);
      throw new Error(`Failed to delete pick ticket: ${error.message}`);
    }
  }

  /**
   * Assign a pick ticket to a user
   */
  async assign(id: string, assignedTo: string, userId?: string): Promise<PickTicket> {
    const { data, error } = await db
      .from('pick_tickets')
      .update({
        assigned_to: assignedTo,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('[PickTicketRepository.assign] Error:', error);
      throw new Error(`Failed to assign pick ticket: ${error.message}`);
    }

    return mapToPickTicket(data as DbPickTicket);
  }

  /**
   * Check if all items are picked
   */
  async areAllItemsPicked(pickTicketId: string): Promise<boolean> {
    const { data, error } = await db
      .from('pick_ticket_items')
      .select('quantity_to_pick, quantity_picked')
      .eq('pick_ticket_id', pickTicketId);

    if (error) {
      console.error('[PickTicketRepository.areAllItemsPicked] Error:', error);
      return false;
    }

    return (data || []).every((item) => item.quantity_picked >= item.quantity_to_pick);
  }
}

// Export singleton instance
export const PickTicketRepository = new PickTicketRepositoryImpl();
