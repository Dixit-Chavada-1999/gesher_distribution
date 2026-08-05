/**
 * Sales Order Module Types
 *
 * All TypeScript interfaces for the Sales Order feature.
 * Structured to mirror future REST API response formats.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  confirmed: 'bg-teal-100 text-teal-800 border border-teal-200',
  processing: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  shipped: 'bg-sky-100 text-sky-800 border border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Statuses that allow editing
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['draft', 'pending'];

/**
 * Check if an order can be edited based on its status
 */
export function canEditOrder(status: OrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

// ============================================
// ORDER CREDIT STATUS
// ============================================

export type OrderCreditStatus = 'ok' | 'hold';

export const ORDER_CREDIT_STATUSES: OrderCreditStatus[] = ['ok', 'hold'];

export const ORDER_CREDIT_STATUS_LABELS: Record<OrderCreditStatus, string> = {
  ok: 'OK',
  hold: 'On Hold',
};

export const ORDER_CREDIT_STATUS_COLORS: Record<OrderCreditStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  hold: 'bg-amber-100 text-amber-800 border border-amber-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Sales Order entity from database
 */
export interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: Date;
  requestedDeliveryDate: Date | null;
  customerId: string;
  salesRepId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  customerPoNumber: string | null;
  status: OrderStatus;
  creditStatus: OrderCreditStatus;

  // Billing Address
  billingAddressStreet: string | null;
  billingAddressCity: string | null;
  billingAddressState: string | null;
  billingAddressPostalCode: string | null;
  billingAddressCountry: string | null;

  // Shipping Address
  shippingAddressStreet: string | null;
  shippingAddressCity: string | null;
  shippingAddressState: string | null;
  shippingAddressPostalCode: string | null;
  shippingAddressCountry: string | null;
  shippingMethod: string | null;

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  // Notes
  customerNotes: string | null;
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
 * Sales Order Item entity from database
 */
export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  lineTotal: number; // cents
  warehouseId: string | null;
  batchNumber: string | null;
  serialNumber: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Sales Order with all related data
 */
export interface SalesOrderWithItems extends SalesOrder {
  items: SalesOrderItem[];
  customer?: CustomerSummary;
  salesRep?: UserSummary;
  warehouse?: LocationSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface CustomerSummary {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LocationSummary {
  id: string;
  locationCode: string;
  name: string;
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

export interface CreateSalesOrderItemDTO {
  productId: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  warehouseId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
}

export interface UpdateSalesOrderItemDTO {
  quantity?: number;
  unitCode?: string;
  unitPrice?: number;
  discountPercent?: number;
  taxRate?: number;
  warehouseId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
}

export interface CreateSalesOrderDTO {
  orderDate: Date;
  requestedDeliveryDate?: Date | null;
  customerId: string;
  salesRepId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  customerPoNumber?: string | null;
  status?: OrderStatus;
  billingAddress: AddressDTO;
  shippingAddress: AddressDTO;
  shippingMethod?: string | null;
  items: CreateSalesOrderItemDTO[];
  customerNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateSalesOrderDTO {
  orderDate?: Date;
  requestedDeliveryDate?: Date | null;
  customerId?: string;
  salesRepId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  customerPoNumber?: string | null;
  billingAddress?: AddressDTO;
  shippingAddress?: AddressDTO;
  shippingMethod?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface SalesOrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
  creditStatus?: OrderCreditStatus;
  customerId?: string;
  salesRepId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesOrderListItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  requestedDeliveryDate: string | null;
  status: OrderStatus;
  creditStatus: OrderCreditStatus;
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

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
}

// ============================================
// MASTER DATA TYPES (for dropdowns)
// ============================================

export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  billingAddress: Address;
  shippingAddress: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unitPrice: number; // dollars for display
  unitId: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  estimatedDays: number;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

// ============================================
// MASTER DATA AGGREGATION
// ============================================

export interface SalesOrderMasterData {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  salesReps: SalesRep[];
  currencies: Currency[];
  shippingMethods: ShippingMethod[];
  units: Unit[];
  taxRates: TaxRate[];
}

// ============================================
// ORDER ITEM TYPES (form state)
// ============================================

export interface OrderItem {
  id?: string;
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitId: string;
  unitPrice: number; // dollars for form
  discountPercent: number;
  taxRateId: string;
  lineTotal: number; // dollars for display

  // Future extension fields (optional)
  warehouseId?: string;
  batchNumber?: string;
  serialNumber?: string;
  priceListId?: string;
  availableQuantity?: number;
}

// Configuration for extensible columns
export interface OrderItemColumnConfig {
  showWarehouse?: boolean;
  showBatch?: boolean;
  showSerialNumber?: boolean;
  showInventoryAvailability?: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalesOrderListResponse {
  data: SalesOrderListItem[];
  meta: PaginationMeta;
}

export interface SalesOrderDetailResponse {
  data: SalesOrderWithItems;
}

export interface MasterDataResponse {
  data: SalesOrderMasterData;
  meta: {
    cachedAt: string;
  };
}

// ============================================
// FORM TYPES
// ============================================

export interface SalesOrderFormData {
  orderNumber?: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  customerId: string;
  salesRepId?: string;
  warehouseId?: string;
  currencyId?: string;
  customerPoNumber?: string;
  status?: OrderStatus;

  billingAddress: Address;
  shippingAddress: Address;
  shippingMethodId?: string;

  items: OrderItem[];

  customerNotes?: string;
  internalNotes?: string;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface SalesOrderInfoSectionProps {
  customers: Customer[];
  salesReps: SalesRep[];
  warehouses: Warehouse[];
  currencies: Currency[];
}

export interface BillingShippingSectionProps {
  shippingMethods: ShippingMethod[];
  isLoadingAddresses?: boolean;
}

export interface OrderItemsTableProps {
  products: Product[];
  units: Unit[];
  taxRates: TaxRate[];
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  onProductSelect?: (itemIndex: number, productId: string) => void;
  columnConfig?: OrderItemColumnConfig;
}

export interface OrderSummaryCardsProps {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  currencySymbol?: string;
  /** Optional slot for credit warning or other content */
  creditSlot?: React.ReactNode;
}

export interface SalesOrderFormProps {
  masterData: SalesOrderMasterData;
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => void;
  onCancel?: () => void;
  onSaveDraft?: (data: SalesOrderFormData) => void;
}

export interface CreateSalesOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  masterData: SalesOrderMasterData;
}

export interface SalesOrdersTableProps {
  data: SalesOrderListItem[];
  isLoading?: boolean;
  onRowClick?: (order: SalesOrderListItem) => void;
  onView?: (order: SalesOrderListItem) => void;
  onEdit?: (order: SalesOrderListItem) => void;
  onDelete?: (order: SalesOrderListItem) => void;
  toolbarContent?: React.ReactNode;
}
