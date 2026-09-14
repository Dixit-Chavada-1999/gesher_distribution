/**
 * MAIN INGESTION SERVICE
 * Orchestrates the entire data ingestion process
 * Quote-first approach: Excel → Quotes → Sales Orders
 */

import { ExcelParserService } from './excel-parser.service';
import { CustomerMatcherService } from './customer-matcher.service';
import { ProductMatcherService } from './product-matcher.service';
import { AddressParserService } from './address-parser.service';
import { IngestionRepository } from '../repositories/ingestion.repository';
import {
  SourceOrderData,
  IngestionResult,
  OrderIngestionResult,
  IngestionOptions,
  NormalizedOrderItem,
} from '../types';

export class IngestionService {
  private excelParser: ExcelParserService;
  private customerMatcher: CustomerMatcherService;
  private productMatcher: ProductMatcherService;
  private addressParser: AddressParserService;
  private repository: IngestionRepository;
  private warehouseLocationNames: string[] = []; // Cache for warehouse location names

  constructor() {
    this.repository = new IngestionRepository();
    this.excelParser = new ExcelParserService();
    this.customerMatcher = new CustomerMatcherService(this.repository);
    this.productMatcher = new ProductMatcherService(this.repository);
    this.addressParser = new AddressParserService();
  }

  /**
   * Main ingestion method
   */
  async ingest(
    ordersFilePath: string,
    customersFilePath: string,
    options: IngestionOptions
  ): Promise<IngestionResult> {
    console.log('🚀 Starting GDC Data Ingestion...\n');

    const startTime = new Date();
    const result: IngestionResult = {
      success: false,
      sessionId: this.generateSessionId(),
      startedAt: startTime,
      completedAt: null,
      stats: {
        ordersProcessed: 0,
        ordersCreated: 0,
        ordersSkipped: 0,
        ordersFailed: 0,
        customersCreated: 0,
        customersMatched: 0,
        productsCreated: 0,
        productsMatched: 0,
        quotesCreated: 0,
        salesOrdersCreated: 0,
        shipmentsCreated: 0,
        documentsUploaded: 0,
      },
      orderResults: [],
      errors: [],
    };

    try {
      // Step 0: Load warehouse locations dynamically
      console.log('📍 Step 0: Loading warehouse locations from database...');
      await this.fetchWarehouseLocations();
      console.log('');

      // Step 1: Parse Excel files
      console.log('📊 Step 1: Parsing Excel files...');
      const sourceOrders = await this.excelParser.parseGDCOrders(ordersFilePath);
      const sourceCustomers = await this.excelParser.parseCustomers(customersFilePath);
      console.log(`   Found: ${sourceOrders.length} orders, ${sourceCustomers.length} customers\n`);

      // Step 2: Process customers
      console.log('👥 Step 2: Processing customers...');
      await this.processCustomers(sourceCustomers, result);
      console.log(`   Created: ${result.stats.customersCreated}, Matched: ${result.stats.customersMatched}\n`);

      // Step 3: Ensure products exist
      console.log('📦 Step 3: Ensuring products exist...');
      await this.ensureProductsExist(result);
      console.log(`   Created: ${result.stats.productsCreated}, Matched: ${result.stats.productsMatched}\n`);

      // Step 4: Process orders (Quote-first)
      console.log('📝 Step 4: Processing orders (Quote-first approach)...');
      await this.processOrders(sourceOrders, result, options);
      console.log(`   Quotes: ${result.stats.quotesCreated}, Sales Orders: ${result.stats.salesOrdersCreated}\n`);

      result.success = true;
      result.completedAt = new Date();

      console.log('✅ Ingestion completed successfully!\n');
      this.printSummary(result);
    } catch (error: any) {
      console.error('❌ Ingestion failed:', error.message);
      result.errors.push({
        sourceRowNumber: null,
        loadNumber: null,
        errorType: 'unknown',
        errorMessage: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    }

    return result;
  }

  /**
   * Process customers from Excel
   */
  private async processCustomers(sourceCustomers: any[], result: IngestionResult) {
    for (const source of sourceCustomers) {
      try {
        const matchResult = await this.customerMatcher.matchCustomer(source);

        if (matchResult.matched) {
          result.stats.customersMatched++;
          console.log(`   ✓ Matched: ${matchResult.name} (EIN: ${matchResult.ein})`);
        } else {
          const normalized = this.customerMatcher.normalizeCustomer(source);
          const created = await this.repository.createCustomer(normalized);
          result.stats.customersCreated++;
          console.log(`   + Created: ${created.name} (EIN: ${normalized.ein})`);
        }
      } catch (error: any) {
        console.error(`   ✗ Failed to process customer ${source.legalName}:`, error.message);
      }
    }
  }

  /**
   * Ensure products exist (38" tire, 24" tire, commission service)
   */
  private async ensureProductsExist(result: IngestionResult) {
    // 38" tire
    const tire38Match = await this.productMatcher.matchProduct('290/85R38');
    if (!tire38Match.matched) {
      await this.repository.createProduct({
        ...this.productMatcher.get38TireDetails(),
        sku: '290-85R38',
      });
      result.stats.productsCreated++;
      console.log('   + Created: 290-85R38 (38" tire)');
    } else {
      result.stats.productsMatched++;
      console.log('   ✓ Matched: 290-85R38 (38" tire)');
    }

    // 24" tire
    const tire24Match = await this.productMatcher.matchProduct('380/85R24');
    if (!tire24Match.matched) {
      await this.repository.createProduct({
        ...this.productMatcher.get24TireDetails(),
        sku: '380-85R24',
      });
      result.stats.productsCreated++;
      console.log('   + Created: 380-85R24 (24" tire)');
    } else {
      result.stats.productsMatched++;
      console.log('   ✓ Matched: 380-85R24 (24" tire)');
    }

    // Commission service
    const commissionMatch = await this.productMatcher.getCommissionProduct();
    if (commissionMatch.action === 'create_new') {
      result.stats.productsCreated++;
      console.log('   + Created: COMMISSION-SERVICE');
    } else {
      result.stats.productsMatched++;
      console.log('   ✓ Matched: COMMISSION-SERVICE');
    }
  }

  /**
   * Process orders (Quote-first approach)
   */
  private async processOrders(
    sourceOrders: SourceOrderData[],
    result: IngestionResult,
    options: IngestionOptions
  ) {
    for (const source of sourceOrders) {
      result.stats.ordersProcessed++;
      const orderResult: OrderIngestionResult = {
        sourceRowNumber: source.rowNumber,
        loadNumber: source.loadNumber,
        action: 'failed',
        quoteId: null,
        salesOrderId: null,
        customerId: null,
        message: '',
        error: null,
      };

      try {
        // Skip if already exists
        if (options.skipExistingOrders) {
          const existing = await this.repository.findSalesOrderByNumber(source.loadNumber);
          if (existing) {
            orderResult.action = 'skipped';
            orderResult.message = `Order ${source.loadNumber} already exists`;
            result.stats.ordersSkipped++;
            result.orderResults.push(orderResult);
            console.log(`   ⊘ Skipped: ${source.loadNumber} (already exists)`);
            continue;
          }
        }

        // Skip rows with invalid customer names (header rows, empty rows)
        if (!source.customerName || source.customerName.trim() === 'Customer') {
          orderResult.message = `Invalid customer name: ${source.customerName || 'empty'}`;
          result.stats.ordersSkipped++;
          result.orderResults.push(orderResult);
          console.log(`   ⊘ Skipped: ${source.loadNumber} (invalid customer name)`);
          continue;
        }

        // Match customer
        const customerMatch = await this.customerMatcher.matchCustomerForOrder(source.customerName);
        if (!customerMatch.customerId) {
          throw new Error(`Customer not found: ${source.customerName}`);
        }
        orderResult.customerId = customerMatch.customerId;

        // Build items
        const items = await this.buildOrderItems(source);

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const taxTotal = 0; // TODO: Calculate tax
        const grandTotal = subtotal + taxTotal;

        // Calculate order date for historical data
        const orderDate = this.calculateHistoricalOrderDate(source);

        // Parse delivery address into components
        const deliveryAddress = this.addressParser.parseFlexible(source.deliveryAddress);

        // Create Quote
        const quoteNumber = this.convertSOToQT(source.loadNumber);
        const quote = await this.repository.createQuote({
          quote_number: quoteNumber,
          quote_date: orderDate, // Same as order date
          customer_id: customerMatch.customerId,
          status: 'accepted',
          currency_code: 'USD',
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          internal_notes: `Order Series: ${source.orderSeries}. ${source.actionRequired || ''}`,
        });
        orderResult.quoteId = quote.id;
        result.stats.quotesCreated++;

        await this.repository.createQuoteItems(quote.id, items);

        // Determine product_source based on customer type
        // Per Ankur (Sept 8 call): Warehouse = "warehouse", Customer = "direct"
        const productSource = this.determineProductSource(source.customerName);

        // Convert Quote → Sales Order (with parsed address)
        const salesOrder = await this.repository.createSalesOrder({
          order_number: source.loadNumber,
          order_date: orderDate,
          order_series: this.mapOrderSeries(source.orderSeries),
          customer_id: customerMatch.customerId,
          product_source: productSource,
          status: this.mapStatus(source.status),
          currency_code: 'USD',
          customer_po_number: source.customerPO,
          subtotal,
          tax_total: taxTotal,
          grand_total: grandTotal,
          // Save parsed address components
          shipping_address_street: deliveryAddress.street || source.deliveryAddress,
          shipping_address_city: deliveryAddress.city,
          shipping_address_state: deliveryAddress.state,
          shipping_address_postal_code: deliveryAddress.postalCode,
          shipping_address_country: deliveryAddress.country,
          internal_notes: source.actionRequired,
          requested_delivery_date: source.customerExpectedDelivery,
        });
        orderResult.salesOrderId = salesOrder.id;
        result.stats.salesOrdersCreated++;

        await this.repository.createSalesOrderItems(salesOrder.id, items);

        // Create Shipment with all tracking data
        await this.repository.createShipment({
          sales_order_id: salesOrder.id,
          supplier_reference_number: source.loadNumber,
          eta_to_port: source.etaToUSPort,
          confirmed_eta: source.confirmedETA,
          customer_expected_delivery: source.customerExpectedDelivery,
          actual_delivery_date: source.actualDeliveryDate,
          qty_delivered: source.qtyDelivered,
          outstanding_qty: source.outstandingQty,
          total_qty: source.totalQty,
          action_required: source.actionRequired,
          load_status: this.mapLoadStatus(source.status),
        });
        result.stats.shipmentsCreated++;

        // Mark quote as converted
        const systemUserId = await this.repository.getSystemUserId();
        await this.repository.markQuoteAsConverted(quote.id, salesOrder.id, systemUserId);

        orderResult.action = 'created';
        orderResult.message = `Successfully created Quote ${quoteNumber} → SO ${source.loadNumber}`;
        result.stats.ordersCreated++;
        result.orderResults.push(orderResult);

        console.log(`   ✓ Created: ${source.loadNumber} (${source.orderSeries})`);
      } catch (error: any) {
        orderResult.error = error.message;
        result.stats.ordersFailed++;
        result.orderResults.push(orderResult);
        console.error(`   ✗ Failed: ${source.loadNumber} - ${error.message}`);
      }
    }
  }

  /**
   * Build order items from source data
   */
  private async buildOrderItems(source: SourceOrderData): Promise<NormalizedOrderItem[]> {
    const items: NormalizedOrderItem[] = [];

    if (source.commissionOnly) {
      // Commission-only order
      const commissionProduct = await this.productMatcher.getCommissionProduct();
      items.push({
        productId: commissionProduct.productId!,
        sku: 'COMMISSION-SERVICE',
        description: 'Sales Commission Service',
        quantity: source.totalQty,
        unitPrice: 27500, // $275 in cents
        taxRate: 0,
        lineTotal: source.totalQty * 27500,
        sortOrder: 0,
      });
    } else {
      // Regular order with tires
      let sortOrder = 0;

      if (source.sku_290_85R38_qty > 0) {
        const product = await this.productMatcher.matchProduct('290/85R38');
        const unitPrice = source.price38 ? source.price38 * 100 : 0; // Convert to cents
        items.push({
          productId: product.productId!,
          sku: '290-85R38',
          description: '290/85R38 Tire (38")',
          quantity: source.sku_290_85R38_qty,
          unitPrice,
          taxRate: 0,
          lineTotal: source.sku_290_85R38_qty * unitPrice,
          sortOrder: sortOrder++,
        });
      }

      if (source.sku_380_85R24_qty > 0) {
        const product = await this.productMatcher.matchProduct('380/85R24');
        const unitPrice = source.price24 ? source.price24 * 100 : 0; // Convert to cents
        items.push({
          productId: product.productId!,
          sku: '380-85R24',
          description: '380/85R24 Tire (24")',
          quantity: source.sku_380_85R24_qty,
          unitPrice,
          taxRate: 0,
          lineTotal: source.sku_380_85R24_qty * unitPrice,
          sortOrder: sortOrder++,
        });
      }
    }

    return items;
  }

  /**
   * Map Excel status to Sales Order status
   */
  private mapStatus(excelStatus: string): string {
    const statusMap: Record<string, string> = {
      INVOICED: 'delivered',
      'IN TRANSIT': 'shipped',
      AVAILABLE: 'confirmed',
      OPEN: 'confirmed',
    };
    return statusMap[excelStatus] || 'confirmed';
  }

  /**
   * Map Excel status to Shipment load_status
   */
  private mapLoadStatus(excelStatus: string): string {
    const statusMap: Record<string, string> = {
      INVOICED: 'invoiced',
      'IN TRANSIT': 'in_transit',
      AVAILABLE: 'available',
      OPEN: 'open',
      SOLD: 'sold',
      HOLD: 'hold',
    };
    return statusMap[excelStatus] || 'open';
  }

  /**
   * Map Excel order series to system order series
   * Returns the order series as-is (GDC 0, GDC 1, etc.)
   */
  private mapOrderSeries(excelOrderSeries: 'GDC 0' | 'GDC 1' | 'GDC 2' | 'GDC 3'): string {
    // Return as-is - all order series are valid
    return excelOrderSeries;
  }

  /**
   * Fetch warehouse location names from database
   * Dynamically loads all active warehouse locations
   */
  private async fetchWarehouseLocations(): Promise<void> {
    const locations = await this.repository.getWarehouseLocations();
    this.warehouseLocationNames = locations.map((loc) => loc.name);

    // Also include "Gesher Distribution Company" as a special warehouse customer
    if (!this.warehouseLocationNames.includes('Gesher Distribution Company')) {
      this.warehouseLocationNames.push('Gesher Distribution Company');
      this.warehouseLocationNames.push('Gesher'); // Short form
    }

    console.log(`📦 Loaded ${this.warehouseLocationNames.length} warehouse locations:`, this.warehouseLocationNames);
  }

  /**
   * Determine product_source based on customer type
   * Per Ankur (Sept 8, 2025 call):
   * - Warehouse inventory (Nebraska/Kansas Warehouse, Gesher) = "warehouse" (inventory-tracked)
   * - Customer orders (Valley, Lindsay, WISH, etc.) = "direct" (direct shipment)
   *
   * IMPORTANT: Warehouse names are dynamically loaded from locations table
   */
  private determineProductSource(customerName: string): 'direct' | 'warehouse' {
    // Check if customer name matches any warehouse location
    const isWarehouse = this.warehouseLocationNames.some(
      (name) => customerName.toLowerCase().includes(name.toLowerCase())
    );

    return isWarehouse ? 'warehouse' : 'direct';
  }

  /**
   * Calculate historical order date from available dates
   */
  private calculateHistoricalOrderDate(source: SourceOrderData): Date {
    // Priority: Use earliest available date, with fallbacks
    const dates = [source.etaToUSPort, source.confirmedETA, source.customerExpectedDelivery].filter(
      (d) => d !== null
    ) as Date[];

    if (dates.length > 0) {
      // Use earliest date minus 30 days (typical lead time)
      const earliestDate = dates.reduce((earliest, current) =>
        current < earliest ? current : earliest
      );
      const orderDate = new Date(earliestDate);
      orderDate.setDate(orderDate.getDate() - 30);
      return orderDate;
    }

    // Fallback: Use fixed historical date (beginning of 2024)
    return new Date('2024-01-01');
  }

  /**
   * Convert SO number to QT number
   * SO2600023 → QT2600023
   */
  private convertSOToQT(soNumber: string): string {
    return soNumber.replace(/^SO/, 'QT');
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `GDC-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Print summary report
   */
  private printSummary(result: IngestionResult) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                   INGESTION SUMMARY                       ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Session ID:        ${result.sessionId}`);
    console.log(`Started:           ${result.startedAt.toLocaleString()}`);
    console.log(`Completed:         ${result.completedAt?.toLocaleString()}`);
    console.log(`Duration:          ${this.formatDuration(result.startedAt, result.completedAt!)}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Orders Processed:  ${result.stats.ordersProcessed}`);
    console.log(`Orders Created:    ${result.stats.ordersCreated} ✓`);
    console.log(`Orders Skipped:    ${result.stats.ordersSkipped}`);
    console.log(`Orders Failed:     ${result.stats.ordersFailed} ✗`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Customers Created: ${result.stats.customersCreated}`);
    console.log(`Customers Matched: ${result.stats.customersMatched}`);
    console.log(`Products Created:  ${result.stats.productsCreated}`);
    console.log(`Products Matched:  ${result.stats.productsMatched}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(`Quotes Created:    ${result.stats.quotesCreated}`);
    console.log(`Sales Orders:      ${result.stats.salesOrdersCreated}`);
    console.log(`Shipments Created: ${result.stats.shipmentsCreated}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (result.stats.ordersFailed > 0) {
      console.log('\n⚠️  ERRORS:');
      result.orderResults
        .filter((r) => r.action === 'failed')
        .forEach((r) => {
          console.log(`   ${r.loadNumber}: ${r.error}`);
        });
    }
  }

  private formatDuration(start: Date, end: Date): string {
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    return `${seconds}s`;
  }
}
