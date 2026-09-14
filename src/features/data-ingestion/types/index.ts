/**
 * DATA INGESTION TYPES
 * TypeScript interfaces for GDC historical data import
 * Based on: docs/DATA_INGESTION_ANALYSIS.md
 */

// ============================================
// SOURCE DATA TYPES (from Excel)
// ============================================

/**
 * Raw order data from Excel sheets (GDC 0, GDC 1)
 */
export interface SourceOrderData {
  // Row identification
  rowNumber: number;
  orderSeries: 'GDC 0' | 'GDC 1' | 'GDC 2' | 'GDC 3';

  // Order identity
  loadNumber: string; // SO2600023, SO2600024, etc.

  // Product quantities
  sku_290_85R38_qty: number; // 38" tire quantity
  sku_380_85R24_qty: number; // 24" tire quantity
  totalQty: number;

  // Customer info
  customerName: string; // Valley, Lindsay, WISH, Nebraska Warehouse, etc.
  customerPO: string | null;

  // Dates
  etaToUSPort: Date | null;
  confirmedETA: Date | null;
  customerExpectedDelivery: Date | null;
  actualDeliveryDate: Date | null;

  // Delivery
  deliveryAddress: string | null;
  qtyDelivered: number | null;
  outstandingQty: number | null;

  // Financials
  customerInvoiceAmount: number | null; // In dollars
  price38: number | null; // Price per 38" tire
  price24: number | null; // Price per 24" tire
  ourCost: number | null;

  // Status
  status: 'INVOICED' | 'IN TRANSIT' | 'AVAILABLE' | 'OPEN';
  actionRequired: string | null;
  notes: string | null;

  // Commission
  commissionOnly: boolean; // YES/NO in Excel
  commissionAmount: number | null; // $275/tire

  // Customer PO document
  customerPODocumentPath: string | null; // Path to PDF file
}

/**
 * Raw customer data from Excel
 */
export interface SourceCustomerData {
  // Company info
  legalName: string;
  ein: string; // Tax ID (e.g., "47-0351813")
  taxExempt: boolean;

  // Billing address
  billingAddress1: string | null;
  billingAddress2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  billingCountry: string;

  // Shipping address
  shippingSameAsBilling: boolean;
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;

  // Contacts
  salesContactName: string | null;
  salesContactEmail: string | null;
  salesContactPhone: string | null;
  billingContactName: string | null;
  billingContactTitle: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;

  // Notes
  notes: string | null;
}

// ============================================
// NORMALIZED DATA TYPES (after processing)
// ============================================

/**
 * Normalized order data ready for database insert
 */
export interface NormalizedOrderData {
  // Source tracking
  sourceRowNumber: number;
  orderSeries: string;

  // Quote data (Quote-first approach)
  quoteNumber: string; // QT2600023 (converted from SO2600023)
  quoteDate: Date;
  quoteStatus: 'accepted'; // All historical quotes are pre-accepted

  // Sales Order data (after conversion)
  orderNumber: string; // SO2600023 (original preserved)
  orderDate: Date;
  orderStatus: 'delivered' | 'shipped' | 'confirmed';

  // Customer
  customerId: string; // UUID (matched or created)
  customerName: string;
  customerPO: string | null;
  customerPODocumentUrl: string | null; // After upload to Supabase Storage

  // Items
  items: NormalizedOrderItem[];

  // Addresses
  shippingAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string;
  };

  // Dates
  requestedDeliveryDate: Date | null;
  actualDeliveryDate: Date | null;

  // Financials (in cents)
  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // Flags
  isCommissionOnly: boolean;
  isUnallocated: boolean; // Nebraska/Kansas Warehouse orders

  // Notes
  internalNotes: string | null;
  actionRequired: string | null;
}

/**
 * Normalized order item (product line)
 */
export interface NormalizedOrderItem {
  productId: string; // UUID (matched or created)
  sku: string; // 290-85R38, 380-85R24, or COMMISSION-SERVICE
  description: string;
  quantity: number;
  unitPrice: number; // In cents
  taxRate: number; // Percentage (0-100)
  lineTotal: number; // In cents
  sortOrder: number;
}

/**
 * Normalized customer data ready for database insert
 */
export interface NormalizedCustomerData {
  // Matching
  ein: string; // Primary match key
  existingCustomerId: string | null; // If matched

  // Company info
  customerCode: string; // Auto-generated: VALMONT, LINDSAY, etc.
  name: string; // Display name
  legalName: string;
  taxExempt: boolean;
  taxExemptNumber: string | null;

  // Addresses
  billingAddress: AddressData;
  shippingAddress: AddressData;

  // Contacts
  contacts: CustomerContactData[];

  // Metadata
  channel: 'oem' | 'dealer';
  status: 'active';
  internalNotes: string | null;
}

/**
 * Address data structure
 */
export interface AddressData {
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
}

/**
 * Customer contact data
 */
export interface CustomerContactData {
  contactType: 'sales' | 'billing' | 'accounts_payable' | 'receiving';
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

// ============================================
// INGESTION RESULT TYPES
// ============================================

/**
 * Result of ingestion operation
 */
export interface IngestionResult {
  success: boolean;
  sessionId: string; // Unique session identifier
  startedAt: Date;
  completedAt: Date | null;

  // Statistics
  stats: {
    ordersProcessed: number;
    ordersCreated: number;
    ordersSkipped: number;
    ordersFailed: number;

    customersCreated: number;
    customersMatched: number;

    productsCreated: number;
    productsMatched: number;

    quotesCreated: number;
    salesOrdersCreated: number;
    shipmentsCreated: number;

    documentsUploaded: number;
  };

  // Detailed results
  orderResults: OrderIngestionResult[];

  // Errors
  errors: IngestionError[];
}

/**
 * Result for individual order ingestion
 */
export interface OrderIngestionResult {
  sourceRowNumber: number;
  loadNumber: string; // SO2600023
  action: 'created' | 'skipped' | 'failed';

  // Created IDs
  quoteId: string | null;
  salesOrderId: string | null;
  customerId: string | null;

  // Details
  message: string;
  error: string | null;
}

/**
 * Ingestion error details
 */
export interface IngestionError {
  sourceRowNumber: number | null;
  loadNumber: string | null;
  errorType: 'validation' | 'database' | 'file' | 'unknown';
  errorMessage: string;
  stack: string | null;
  timestamp: Date;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Dry run options
 */
export interface DryRunOptions {
  maxRecords: number | null; // Limit to N records (null = all)
  skipPDFUpload: boolean; // Skip uploading customer PO documents
  verbose: boolean; // Show detailed logs
}

/**
 * Ingestion options
 */
export interface IngestionOptions {
  dryRun: boolean;
  skipExistingOrders: boolean; // Skip if order_number already exists
  sessionName: string; // User-provided session identifier
  createdBy: string; // User ID running the import
}

/**
 * Product match result
 */
export interface ProductMatchResult {
  matched: boolean;
  productId: string | null;
  sku: string;
  action: 'matched' | 'create_new';
}

/**
 * Customer match result
 */
export interface CustomerMatchResult {
  matched: boolean;
  customerId: string | null;
  ein: string;
  name: string;
  action: 'matched_by_ein' | 'matched_by_name' | 'create_new';
  confidence: 'high' | 'medium' | 'low';
}
