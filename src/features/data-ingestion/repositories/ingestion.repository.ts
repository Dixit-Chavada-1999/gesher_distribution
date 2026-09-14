/**
 * INGESTION REPOSITORY
 * Database operations for data ingestion
 * Handles customers, products, quotes, and sales orders
 */

import { createClient } from '@supabase/supabase-js';
import { NormalizedCustomerData } from '../types';

export class IngestionRepository {
  private supabase;

  constructor() {
    // Initialize Supabase client for CLI scripts
    // Use SERVICE_ROLE_KEY for data ingestion to bypass RLS policies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables. Please check .env file.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ============================================
  // CUSTOMER OPERATIONS
  // ============================================

  /**
   * Find customer by EIN (Tax ID)
   */
  async findCustomerByEIN(ein: string) {
    const { data, error } = await this.supabase
      .from('customers')
      .select('id, name, tax_id')
      .eq('tax_id', ein)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Find customer by normalized name (with fuzzy matching)
   */
  async findCustomerByName(normalizedName: string) {
    // First try exact match
    const exactMatch = await this.supabase
      .from('customers')
      .select('id, name, tax_id')
      .ilike('name', `${normalizedName}`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (exactMatch.data) return exactMatch.data;

    // Try partial match (search term is contained in customer name)
    const partialMatch = await this.supabase
      .from('customers')
      .select('id, name, tax_id')
      .ilike('name', `%${normalizedName}%`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (partialMatch.data) return partialMatch.data;

    // Try reverse partial match (customer name starts with search term)
    // e.g., "Valley" matches "Valmont Industries"
    const reverseMatch = await this.supabase
      .from('customers')
      .select('id, name, tax_id')
      .ilike('name', `${normalizedName}%`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (reverseMatch.data) return reverseMatch.data;

    return null;
  }

  /**
   * Find or create internal customer for unallocated inventory
   */
  async findOrCreateInternalCustomer() {
    const customerCode = 'GDC-INTERNAL';

    // Try to find existing
    const { data: existing } = await this.supabase
      .from('customers')
      .select('id, name')
      .eq('customer_code', customerCode)
      .is('deleted_at', null)
      .single();

    if (existing) return existing;

    // Create new internal customer
    const { data: newCustomer, error } = await this.supabase
      .from('customers')
      .insert({
        customer_code: customerCode,
        name: 'Gesher Distribution Company',
        legal_name: 'Gesher Distribution Company',
        channel: 'oem',
        status: 'active',
        internal_notes: 'Internal customer for unallocated inventory tracking',
      })
      .select('id, name')
      .single();

    if (error) throw new Error(`Failed to create internal customer: ${error.message}`);
    return newCustomer!;
  }

  /**
   * Create new customer
   */
  async createCustomer(customer: NormalizedCustomerData) {
    const { data, error } = await this.supabase
      .from('customers')
      .insert({
        customer_code: customer.customerCode,
        name: customer.name,
        legal_name: customer.legalName,
        tax_id: customer.ein,
        tax_exempt: customer.taxExempt,
        tax_exempt_number: customer.taxExemptNumber,
        channel: customer.channel,
        status: customer.status,
        // Billing address (matches migration 008 schema)
        address_1: customer.billingAddress.address1,
        address_2: customer.billingAddress.address2,
        city: customer.billingAddress.city,
        state: customer.billingAddress.state,
        zip: customer.billingAddress.postalCode,
        country: customer.billingAddress.country,
        // Shipping address (matches migration 008 schema)
        shipping_address_1: customer.shippingAddress.address1,
        shipping_address_2: customer.shippingAddress.address2,
        shipping_city: customer.shippingAddress.city,
        shipping_state: customer.shippingAddress.state,
        shipping_zip: customer.shippingAddress.postalCode,
        shipping_country: customer.shippingAddress.country,
        use_separate_shipping: true,
        internal_notes: customer.internalNotes,
      })
      .select('id, name')
      .single();

    if (error) throw new Error(`Failed to create customer: ${error.message}`);
    return data!;
  }

  // ============================================
  // LOCATION OPERATIONS
  // ============================================

  /**
   * Get all active warehouse locations
   * Used to dynamically determine if a customer name is a warehouse
   */
  async getWarehouseLocations(): Promise<Array<{ id: string; name: string; location_code: string }>> {
    const { data, error } = await this.supabase
      .from('locations')
      .select('id, name, location_code')
      .eq('location_type', 'warehouse')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (error) {
      console.warn(`⚠️  Failed to fetch warehouse locations: ${error.message}`);
      // Return default fallback warehouses if query fails
      return [
        { id: '', name: 'Nebraska Warehouse', location_code: 'WH-NEB' },
        { id: '', name: 'Kansas Warehouse', location_code: 'WH-KAN' },
      ];
    }

    return data || [];
  }

  // ============================================
  // PRODUCT OPERATIONS
  // ============================================

  /**
   * Find product by SKU
   */
  async findProductBySKU(sku: string) {
    const { data, error } = await this.supabase
      .from('products')
      .select('id, sku, name')
      .eq('sku', sku)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create new product
   */
  async createProduct(product: any) {
    const { data, error } = await this.supabase
      .from('products')
      .insert(product)
      .select('id, sku, name')
      .single();

    if (error) throw new Error(`Failed to create product: ${error.message}`);
    return data!;
  }

  // ============================================
  // QUOTE OPERATIONS
  // ============================================

  /**
   * Create quote
   */
  async createQuote(quote: {
    quote_number: string;
    quote_date: Date;
    customer_id: string;
    status: string;
    currency_code: string;
    subtotal: number;
    tax_total: number;
    grand_total: number;
    internal_notes?: string | null;
    po_document_url?: string | null;
  }) {
    const { data, error } = await this.supabase
      .from('quotes')
      .insert(quote)
      .select('id, quote_number')
      .single();

    if (error) throw new Error(`Failed to create quote: ${error.message}`);
    return data!;
  }

  /**
   * Create quote items
   */
  async createQuoteItems(quoteId: string, items: any[]) {
    const itemsToInsert = items.map((item, index) => ({
      quote_id: quoteId,
      product_id: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit_code: 'EA',
      unit_price: item.unitPrice,
      tax_rate: item.taxRate,
      line_total: item.lineTotal,
      sort_order: index,
    }));

    const { error } = await this.supabase.from('quote_items').insert(itemsToInsert);

    if (error) throw new Error(`Failed to create quote items: ${error.message}`);
  }

  /**
   * Update quote status to converted
   */
  async markQuoteAsConverted(quoteId: string, salesOrderId: string, convertedBy: string) {
    const { error } = await this.supabase
      .from('quotes')
      .update({
        status: 'converted',
        converted_to_sales_order_id: salesOrderId,
        converted_at: new Date().toISOString(),
        converted_by: convertedBy,
      })
      .eq('id', quoteId);

    if (error) throw new Error(`Failed to mark quote as converted: ${error.message}`);
  }

  // ============================================
  // SALES ORDER OPERATIONS
  // ============================================

  /**
   * Check if sales order already exists
   */
  async findSalesOrderByNumber(orderNumber: string) {
    const { data, error } = await this.supabase
      .from('sales_orders')
      .select('id, order_number')
      .eq('order_number', orderNumber)
      .is('deleted_at', null)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create sales order
   */
  async createSalesOrder(order: {
    order_number: string;
    order_date: Date;
    order_series?: string;
    customer_id: string;
    product_source?: string;
    status: string;
    currency_code: string;
    customer_po_number?: string | null;
    subtotal: number;
    tax_total: number;
    grand_total: number;
    shipping_address_street?: string | null;
    shipping_address_city?: string | null;
    shipping_address_state?: string | null;
    shipping_address_postal_code?: string | null;
    shipping_address_country?: string;
    internal_notes?: string | null;
    requested_delivery_date?: Date | null;
  }) {
    const { data, error } = await this.supabase
      .from('sales_orders')
      .insert(order)
      .select('id, order_number')
      .single();

    if (error) throw new Error(`Failed to create sales order: ${error.message}`);
    return data!;
  }

  /**
   * Create sales order items
   */
  async createSalesOrderItems(salesOrderId: string, items: any[]) {
    const itemsToInsert = items.map((item, index) => ({
      sales_order_id: salesOrderId,
      product_id: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit_code: 'EA',
      unit_price: item.unitPrice,
      tax_rate: item.taxRate,
      line_total: item.lineTotal,
      sort_order: index,
    }));

    const { error } = await this.supabase.from('sales_order_items').insert(itemsToInsert);

    if (error) throw new Error(`Failed to create sales order items: ${error.message}`);
  }

  // ============================================
  // SHIPMENT OPERATIONS
  // ============================================

  /**
   * Generate shipment number using database function
   */
  async generateShipmentNumber(): Promise<string> {
    const { data, error } = await this.supabase.rpc('generate_shipment_number');

    if (error) {
      // Fallback: generate locally if RPC fails
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 99999) + 1;
      return `SH-${year}-${String(random).padStart(5, '0')}`;
    }

    return data;
  }

  /**
   * Create shipment for sales order
   */
  async createShipment(shipment: {
    sales_order_id: string;
    supplier_reference_number: string;
    eta_to_port?: Date | null;
    confirmed_eta?: Date | null;
    customer_expected_delivery?: Date | null;
    actual_delivery_date?: Date | null;
    qty_delivered?: number | null;
    outstanding_qty?: number | null;
    total_qty?: number;
    action_required?: string | null;
    load_status?: string;
  }) {
    // Generate shipment number
    const shipmentNumber = await this.generateShipmentNumber();

    const { data, error } = await this.supabase
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        sales_order_id: shipment.sales_order_id,
        supplier_reference_number: shipment.supplier_reference_number,
        eta_to_port: shipment.eta_to_port,
        confirmed_eta: shipment.confirmed_eta,
        customer_expected_delivery: shipment.customer_expected_delivery,
        // actual_delivery_date: shipment.actual_delivery_date, // Column doesn't exist yet - will add in future migration
        qty_delivered: shipment.qty_delivered || 0,
        outstanding_qty: shipment.outstanding_qty || 0,
        total_qty: shipment.total_qty || 0,
        action_required: shipment.action_required,
        load_status: shipment.load_status || 'open',
        status: 'pending', // Initial shipment status
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create shipment: ${error.message}`);
    return data!;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get system user ID for created_by fields
   */
  async getSystemUserId(): Promise<string> {
    // Try to find "system" or "admin" user
    const { data } = await this.supabase
      .from('users')
      .select('id')
      .or('email.eq.superadmin@gmail.com,email.eq.admin@gesher.com')
      .is('deleted_at', null)
      .limit(1)
      .single();

    return data?.id || '00000000-0000-0000-0000-000000000000'; // Fallback to null UUID
  }
}
