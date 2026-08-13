/**
 * Pick Tickets Module Types
 *
 * All TypeScript interfaces for the Pick Tickets feature.
 * Handles warehouse fulfillment workflow: Pick -> Pack -> Ship
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PickTicketStatus =
  | 'pending'
  | 'assigned'
  | 'picking'
  | 'picked'
  | 'packing'
  | 'packed'
  | 'shipped'
  | 'cancelled';

export const PICK_TICKET_STATUSES: PickTicketStatus[] = [
  'pending',
  'assigned',
  'picking',
  'picked',
  'packing',
  'packed',
  'shipped',
  'cancelled',
];

export const PICK_TICKET_STATUS_LABELS: Record<PickTicketStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picking: 'Picking',
  picked: 'Picked',
  packing: 'Packing',
  packed: 'Packed',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
};

export const PICK_TICKET_STATUS_COLORS: Record<PickTicketStatus, string> = {
  pending: 'bg-stone-100 text-stone-700 border border-stone-200',
  assigned: 'bg-blue-100 text-blue-700 border border-blue-200',
  picking: 'bg-amber-100 text-amber-700 border border-amber-200',
  picked: 'bg-teal-100 text-teal-700 border border-teal-200',
  packing: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  packed: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  shipped: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border border-red-200',
};

// Valid status transitions
export const PICK_TICKET_STATUS_TRANSITIONS: Record<PickTicketStatus, PickTicketStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picking', 'cancelled'],
  picking: ['picked', 'cancelled'],
  picked: ['packing'],
  packing: ['packed'],
  packed: ['shipped'],
  shipped: [],
  cancelled: [],
};

// Priority
export type PickTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export const PICK_TICKET_PRIORITIES: PickTicketPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

export const PICK_TICKET_PRIORITY_LABELS: Record<PickTicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const PICK_TICKET_PRIORITY_COLORS: Record<PickTicketPriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

// Packing List Status
export type PackingListStatus = 'draft' | 'packed' | 'shipped';

export const PACKING_LIST_STATUSES: PackingListStatus[] = [
  'draft',
  'packed',
  'shipped',
];

export const PACKING_LIST_STATUS_LABELS: Record<PackingListStatus, string> = {
  draft: 'Draft',
  packed: 'Packed',
  shipped: 'Shipped',
};

export const PACKING_LIST_STATUS_COLORS: Record<PackingListStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  packed: 'bg-teal-100 text-teal-700 border border-teal-200',
  shipped: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Pick Ticket entity from database
 */
export interface PickTicket {
  id: string;
  pickTicketNumber: string;
  salesOrderId: string;
  warehouseId: string;
  assignedTo: string | null;
  assignedAt: Date | null;
  priority: PickTicketPriority;
  status: PickTicketStatus;
  pickingStartedAt: Date | null;
  pickingCompletedAt: Date | null;
  notes: string | null;
  specialInstructions: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Pick Ticket Item entity from database
 */
export interface PickTicketItem {
  id: string;
  pickTicketId: string;
  salesOrderItemId: string;
  productId: string;
  sku: string;
  description: string | null;
  binLocation: string | null;
  quantityToPick: number;
  quantityPicked: number;
  pickedAt: Date | null;
  pickedBy: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Packing List entity from database
 */
export interface PackingList {
  id: string;
  packingListNumber: string;
  pickTicketId: string;
  salesOrderId: string;
  shipmentId: string | null;
  totalPackages: number;
  totalWeight: number | null;
  weightUnit: string;
  status: PackingListStatus;
  packedAt: Date | null;
  packedBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Packing List Item entity from database
 */
export interface PackingListItem {
  id: string;
  packingListId: string;
  pickTicketItemId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantityPacked: number;
  packageNumber: number;
  weight: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Pick Ticket with all related data
 */
export interface PickTicketWithItems extends PickTicket {
  items: PickTicketItem[];
  salesOrder?: SalesOrderSummary;
  warehouse?: WarehouseSummary;
  assignedUser?: UserSummary;
  packingList?: PackingListSummary;
}

/**
 * Packing List with all related data
 */
export interface PackingListWithItems extends PackingList {
  items: PackingListItem[];
  pickTicket?: PickTicketSummary;
  salesOrder?: SalesOrderSummary;
  shipment?: ShipmentSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
}

export interface WarehouseSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PickTicketSummary {
  id: string;
  pickTicketNumber: string;
  status: PickTicketStatus;
}

export interface PackingListSummary {
  id: string;
  packingListNumber: string;
  status: PackingListStatus;
}

export interface ShipmentSummary {
  id: string;
  shipmentNumber: string;
  status: string;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreatePickTicketItemDTO {
  salesOrderItemId: string;
  productId: string;
  sku: string;
  description: string | null;
  binLocation?: string | null;
  quantityToPick: number;
}

export interface CreatePickTicketDTO {
  salesOrderId: string;
  warehouseId: string;
  assignedTo?: string | null;
  priority?: PickTicketPriority;
  notes?: string | null;
  specialInstructions?: string | null;
  items: CreatePickTicketItemDTO[];
}

export interface UpdatePickTicketDTO {
  assignedTo?: string | null;
  priority?: PickTicketPriority;
  notes?: string | null;
  specialInstructions?: string | null;
}

export interface PickItemDTO {
  pickTicketItemId: string;
  quantityPicked: number;
}

export interface CreatePackingListItemDTO {
  pickTicketItemId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantityPacked: number;
  packageNumber: number;
  weight?: number | null;
}

export interface CreatePackingListDTO {
  pickTicketId: string;
  salesOrderId: string;
  totalPackages?: number;
  totalWeight?: number | null;
  weightUnit?: string;
  notes?: string | null;
  items: CreatePackingListItemDTO[];
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface PickTicketListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PickTicketStatus;
  priority?: PickTicketPriority;
  warehouseId?: string;
  salesOrderId?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PickTicketListItem {
  id: string;
  pickTicketNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  warehouseId: string;
  warehouseName: string;
  assignedTo: string | null;
  assignedUserName: string | null;
  priority: PickTicketPriority;
  status: PickTicketStatus;
  itemCount: number;
  totalQuantity: number;
  pickedQuantity: number;
  createdAt: Date;
}

export interface PackingListListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PackingListStatus;
  pickTicketId?: string;
  salesOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PackingListListItem {
  id: string;
  packingListNumber: string;
  pickTicketNumber: string;
  salesOrderNumber: string;
  customerName: string;
  totalPackages: number;
  totalWeight: number | null;
  status: PackingListStatus;
  shipmentNumber: string | null;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface PickTicketsTableProps {
  data: PickTicketListItem[];
  isLoading?: boolean;
  onRowClick?: (pickTicket: PickTicketListItem) => void;
  onView?: (pickTicket: PickTicketListItem) => void;
  onEdit?: (pickTicket: PickTicketListItem) => void;
  onDelete?: (pickTicket: PickTicketListItem) => void;
  onAssign?: (pickTicket: PickTicketListItem) => void;
  onStartPicking?: (pickTicket: PickTicketListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface CreatePickTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  salesOrderId?: string;
  onSuccess?: () => void;
}

export interface ViewPickTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  pickTicketId: string | null;
  onEdit?: (pickTicket: PickTicketListItem | PickTicketWithItems) => void;
  onStartPicking?: (pickTicket: PickTicketWithItems) => void;
  onPackingListCreated?: () => void;
}

export interface PickingInterfaceProps {
  pickTicket: PickTicketWithItems;
  onItemPicked?: (itemId: string, quantity: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

export interface PackingListDrawerProps {
  open: boolean;
  onClose: () => void;
  pickTicketId: string;
  onSuccess?: () => void;
}
