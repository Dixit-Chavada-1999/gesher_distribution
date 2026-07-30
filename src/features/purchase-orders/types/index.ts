/**
 * Purchase Orders Module Types
 *
 * All TypeScript interfaces for the Purchase Orders feature.
 * Per client doc: POs always go to Galileo (Alon) - single supplier
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type POStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'partial'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'draft',
  'sent',
  'confirmed',
  'partial',
  'received',
  'cancelled',
];

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partial: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  sent: 'bg-sky-100 text-sky-800 border border-sky-200',
  confirmed: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  partial: 'bg-amber-100 text-amber-800 border border-amber-200',
  received: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions per client doc
export const PO_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

// Default supplier per client doc
export const DEFAULT_SUPPLIER = {
  name: 'Galileo',
  contact: 'Alon',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Purchase Order entity from database
 */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: Date;
  expectedDeliveryDate: Date | null;

  // Supplier (always Galileo/Alon per client doc)
  supplierName: string;
  supplierContact: string;

  // Relationships
  salesOrderId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  status: POStatus;

  // Supplier Address (denormalized)
  vendorAddressStreet: string | null;
  vendorAddressCity: string | null;
  vendorAddressState: string | null;
  vendorAddressPostalCode: string | null;
  vendorAddressCountry: string | null;

  // Ship To Address (denormalized)
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;

  // Totals (in cents)
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  // Notes
  vendorNotes: string | null;
  internalNotes: string | null;

  // Cancellation
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Purchase Order Item entity from database
 */
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  salesOrderItemId: string | null;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCode: string;
  unitPrice: number; // cents
  taxRate: number;
  lineTotal: number; // cents
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Purchase Order with all related data
 */
export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
  salesOrder?: SalesOrderSummary;
  warehouse?: LocationSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
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

export interface CreatePOItemDTO {
  productId: string;
  salesOrderItemId?: string | null;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  unitCode: string;
  unitPrice: number; // cents
  taxRate: number;
}

export interface CreatePurchaseOrderDTO {
  poDate: Date;
  expectedDeliveryDate?: Date | null;
  salesOrderId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  status?: POStatus;
  supplierName?: string; // defaults to Galileo
  supplierContact?: string; // defaults to Alon
  vendorAddress: AddressDTO;
  shipToAddress: AddressDTO;
  items: CreatePOItemDTO[];
  vendorNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdatePurchaseOrderDTO {
  poDate?: Date;
  expectedDeliveryDate?: Date | null;
  warehouseId?: string | null;
  currencyCode?: string;
  vendorAddress?: AddressDTO;
  shipToAddress?: AddressDTO;
  vendorNotes?: string | null;
  internalNotes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface POListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: POStatus;
  salesOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface POListItem {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierContact: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: POStatus;
  grandTotal: number; // cents
  currencyCode: string;
  itemCount: number;
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

export interface POTotals {
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface PurchaseOrdersTableProps {
  data: POListItem[];
  isLoading?: boolean;
  onRowClick?: (po: POListItem) => void;
  onView?: (po: POListItem) => void;
  onEdit?: (po: POListItem) => void;
  onDelete?: (po: POListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface CreatePurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditPurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  poId: string;
  onSuccess?: () => void;
}

export interface ViewPurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  poId: string | null;
  onEdit?: (po: POListItem | PurchaseOrderWithItems) => void;
}
