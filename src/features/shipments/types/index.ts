/**
 * Shipments Module Types
 *
 * All TypeScript interfaces for the Shipments feature.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'pending',
  'in_transit',
  'delivered',
  'failed',
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending: 'bg-stone-100 text-stone-700 border border-stone-200',
  in_transit: 'bg-sky-100 text-sky-800 border border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  failed: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: [],
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Shipment entity from database
 */
export interface Shipment {
  id: string;
  shipmentNumber: string;
  shipmentDate: Date;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  serviceType: string | null;
  fromLocationId: string | null;

  // Ship To Address (denormalized)
  shipToName: string | null;
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;

  // Shipment Details
  totalWeight: number | null;
  weightUnit: string;
  totalPackages: number;

  // Status
  status: ShipmentStatus;

  // Notes
  notes: string | null;
  deliveryInstructions: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Shipment Item entity from database
 */
export interface ShipmentItem {
  id: string;
  shipmentId: string;
  productId: string;
  salesOrderItemId: string | null;
  purchaseOrderItemId: string | null;
  sku: string;
  description: string | null;
  quantityShipped: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Shipment with all related data
 */
export interface ShipmentWithItems extends Shipment {
  items: ShipmentItem[];
  salesOrder?: SalesOrderSummary;
  purchaseOrder?: PurchaseOrderSummary;
  fromLocation?: LocationSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
}

export interface LocationSummary {
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

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface AddressDTO {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface CreateShipmentItemDTO {
  productId: string;
  salesOrderItemId?: string | null;
  purchaseOrderItemId?: string | null;
  sku: string;
  description: string | null;
  quantityShipped: number;
}

export interface CreateShipmentDTO {
  shipmentDate: Date;
  estimatedArrival?: Date | null;
  salesOrderId?: string | null;
  purchaseOrderId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  serviceType?: string | null;
  fromLocationId?: string | null;
  shipToName?: string | null;
  shipToAddress: AddressDTO;
  totalWeight?: number | null;
  weightUnit?: string;
  totalPackages?: number;
  status?: ShipmentStatus;
  items: CreateShipmentItemDTO[];
  notes?: string | null;
  deliveryInstructions?: string | null;
}

export interface UpdateShipmentDTO {
  shipmentDate?: Date;
  estimatedArrival?: Date | null;
  actualArrival?: Date | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  serviceType?: string | null;
  fromLocationId?: string | null;
  shipToName?: string | null;
  shipToAddress?: AddressDTO;
  totalWeight?: number | null;
  weightUnit?: string;
  totalPackages?: number;
  notes?: string | null;
  deliveryInstructions?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface ShipmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ShipmentStatus;
  salesOrderId?: string;
  purchaseOrderId?: string;
  carrier?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ShipmentListItem {
  id: string;
  shipmentNumber: string;
  shipmentDate: string;
  estimatedArrival: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  itemCount: number;
  salesOrderNumber: string | null;
  purchaseOrderNumber: string | null;
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

export interface ShipmentsTableProps {
  data: ShipmentListItem[];
  isLoading?: boolean;
  onRowClick?: (shipment: ShipmentListItem) => void;
  onView?: (shipment: ShipmentListItem) => void;
  onEdit?: (shipment: ShipmentListItem) => void;
  onDelete?: (shipment: ShipmentListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface CreateShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  onSuccess?: () => void;
}

export interface ViewShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  onEdit?: () => void;
}
