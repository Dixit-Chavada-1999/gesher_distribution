/**
 * Quotes Module Types
 *
 * All TypeScript interfaces for the Quotes feature.
 * Structured to mirror future REST API response formats.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export const QUOTE_STATUSES: QuoteStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  sent: 'bg-sky-100 text-sky-800 border border-sky-200',
  accepted: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border border-red-200',
  expired: 'bg-amber-100 text-amber-800 border border-amber-200',
  converted: 'bg-teal-100 text-teal-800 border border-teal-200',
};

// Valid status transitions
export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Quote entity from database
 */
export interface Quote {
  id: string;
  quoteNumber: string;
  quoteDate: Date;
  validUntil: Date | null;
  customerId: string;
  salesRepId: string | null;
  currencyCode: string;
  status: QuoteStatus;

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

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;

  // Notes
  customerNotes: string | null;
  internalNotes: string | null;
  termsAndConditions: string | null;

  // Chain Link
  convertedToSalesOrderId: string | null;
  convertedAt: Date | null;
  convertedBy: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Quote Item entity from database
 */
export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  lineTotal: number; // cents
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Quote with all related data
 */
export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
  customer?: CustomerSummary;
  salesRep?: UserSummary;
  salesOrder?: SalesOrderSummary;
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

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
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

export interface CreateQuoteItemDTO {
  productId: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
}

export interface UpdateQuoteItemDTO {
  quantity?: number;
  unitCode?: string;
  unitPrice?: number;
  discountPercent?: number;
  taxRate?: number;
}

export interface CreateQuoteDTO {
  quoteDate: Date;
  validUntil?: Date | null;
  customerId: string;
  salesRepId?: string | null;
  currencyCode?: string;
  status?: QuoteStatus;
  billingAddress: AddressDTO;
  shippingAddress: AddressDTO;
  items: CreateQuoteItemDTO[];
  customerNotes?: string | null;
  internalNotes?: string | null;
  termsAndConditions?: string | null;
}

export interface UpdateQuoteDTO {
  quoteDate?: Date;
  validUntil?: Date | null;
  customerId?: string;
  salesRepId?: string | null;
  currencyCode?: string;
  billingAddress?: AddressDTO;
  shippingAddress?: AddressDTO;
  customerNotes?: string | null;
  internalNotes?: string | null;
  termsAndConditions?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface QuoteListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuoteStatus;
  customerId?: string;
  salesRepId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QuoteListItem {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  quoteDate: string;
  validUntil: string | null;
  status: QuoteStatus;
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

export interface QuoteTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
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

export interface QuoteMasterData {
  customers: Customer[];
  products: Product[];
  salesReps: SalesRep[];
  currencies: Currency[];
  units: Unit[];
  taxRates: TaxRate[];
}

// ============================================
// QUOTE ITEM TYPES (form state)
// ============================================

export interface QuoteItemForm {
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

export interface QuoteListResponse {
  data: QuoteListItem[];
  meta: PaginationMeta;
}

export interface QuoteDetailResponse {
  data: QuoteWithItems;
}

export interface MasterDataResponse {
  data: QuoteMasterData;
  meta: {
    cachedAt: string;
  };
}

// ============================================
// FORM TYPES
// ============================================

export interface QuoteFormData {
  quoteNumber?: string;
  quoteDate: string;
  validUntil?: string;
  customerId: string;
  salesRepId?: string;
  currencyId?: string;
  status?: QuoteStatus;

  billingAddress: Address;
  shippingAddress: Address;

  items: QuoteItemForm[];

  customerNotes?: string;
  internalNotes?: string;
  termsAndConditions?: string;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface QuotesTableProps {
  data: QuoteListItem[];
  isLoading?: boolean;
  onRowClick?: (quote: QuoteListItem) => void;
  onView?: (quote: QuoteListItem) => void;
  onEdit?: (quote: QuoteListItem) => void;
  onDelete?: (quote: QuoteListItem) => void;
  onConvert?: (quote: QuoteListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface CreateQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  masterData: QuoteMasterData;
  onSuccess?: () => void;
}

export interface EditQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  masterData: QuoteMasterData;
  onSuccess?: () => void;
}

export interface ViewQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  onEdit?: () => void;
  onConvert?: () => void;
}
