/**
 * EXCEL PARSER SERVICE
 * Reads and parses GDC Excel files (GDC 0 and GDC 1 sheets)
 * Based on: docs/DATA_INGESTION_ANALYSIS.md
 */

import * as XLSX from 'xlsx';
import { SourceOrderData, SourceCustomerData } from '../types';

export class ExcelParserService {
  /**
   * Parse GDC orders from Excel file
   * @param filePath Path to "Data Ingestion GDC.xlsx"
   * @returns Array of source order data from both sheets
   */
  async parseGDCOrders(filePath: string): Promise<SourceOrderData[]> {
    const workbook = XLSX.readFile(filePath);

    const orders: SourceOrderData[] = [];

    // Parse GDC 0 sheet (rows 3-18: 16 orders)
    const gdc0Orders = this.parseGDC0Sheet(workbook);
    orders.push(...gdc0Orders);

    // Parse GDC 1 sheet (rows 3-19: 17 orders)
    const gdc1Orders = this.parseGDC1Sheet(workbook);
    orders.push(...gdc1Orders);

    console.log(`✅ Parsed ${orders.length} orders (GDC 0: ${gdc0Orders.length}, GDC 1: ${gdc1Orders.length})`);

    return orders;
  }

  /**
   * Parse GDC 0 sheet
   */
  private parseGDC0Sheet(workbook: XLSX.WorkBook): SourceOrderData[] {
    const sheetName = 'GDC 0';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    const orders: SourceOrderData[] = [];

    // Data starts at row 3 (0-indexed row 2), rows 3-20 = 18 rows
    // We read extra rows and let the parser skip empty/invalid rows
    for (let row = 3; row <= 20; row++) {
      const order = this.parseOrderRow(sheet, row, 'GDC 0');
      if (order) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * Parse GDC 1 sheet
   */
  private parseGDC1Sheet(workbook: XLSX.WorkBook): SourceOrderData[] {
    const sheetName = 'GDC 1';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    const orders: SourceOrderData[] = [];

    // Data starts at row 3 (0-indexed row 2), rows 3-20 = 18 rows (to catch SO2600053)
    // We read extra rows and let the parser skip empty/invalid rows
    for (let row = 3; row <= 20; row++) {
      const order = this.parseOrderRow(sheet, row, 'GDC 1');
      if (order) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * Parse individual order row
   * Column structure (0-indexed):
   * Col 0: No.
   * Col 1: Load # (SO number)
   * Col 2: SKU 290/85R38 CW Qty
   * Col 3: SKU 380/85R24 CW Qty
   * Col 4: Total Qty
   * Col 5: Customer
   * Col 6: PO
   * Col 7: ETA to US Port
   * Col 8: Delivery Address
   * Col 9: Confirmed ETA
   * Col 10: Customer Expected Delivery
   * Col 11: Actual Delivery Date
   * Col 12: Qty Delivered
   * Col 13: Outstanding Qty for PO
   * Col 14: Customer Invoice Amount
   * Col 15: 38" Price
   * Col 16: 24" Price
   * Col 17: Status
   * Col 18: Action Required / Notes
   * Col 19: Our Cost
   * Col 20: Commission Only (Galileo Invoice)
   * Col 21: Commission Amount ($275/Tire)
   */
  private parseOrderRow(
    sheet: XLSX.WorkSheet,
    row: number,
    orderSeries: 'GDC 0' | 'GDC 1' | 'GDC 2' | 'GDC 3'
  ): SourceOrderData | null {
    const getCellValue = (col: number): any => {
      const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col });
      const cell = sheet[cellAddress];
      return cell ? cell.v : null;
    };

    // Load number is required
    const loadNumber = getCellValue(1);
    if (!loadNumber) {
      console.warn(`⚠️  Row ${row}: No load number, skipping`);
      return null;
    }

    // Parse quantities
    const qty38 = this.parseNumber(getCellValue(2)) || 0;
    const qty24 = this.parseNumber(getCellValue(3)) || 0;
    const totalQty = this.parseNumber(getCellValue(4)) || (qty38 + qty24);

    // Customer name
    const customerName = getCellValue(5)?.toString().trim() || '';

    // Commission only flag
    const commissionOnlyRaw = getCellValue(20)?.toString().toUpperCase();
    const commissionOnly = commissionOnlyRaw === 'YES' || commissionOnlyRaw === 'PERMISSION ONLY';

    // Status
    const statusRaw = getCellValue(17)?.toString().trim().toUpperCase() || 'OPEN';
    const status = this.normalizeStatus(statusRaw);

    const order: SourceOrderData = {
      rowNumber: row,
      orderSeries,
      loadNumber: loadNumber.toString().trim(),
      sku_290_85R38_qty: qty38,
      sku_380_85R24_qty: qty24,
      totalQty,
      customerName,
      customerPO: getCellValue(6)?.toString().trim() || null,
      etaToUSPort: this.parseDate(getCellValue(7)),
      confirmedETA: this.parseDate(getCellValue(9)),
      customerExpectedDelivery: this.parseDate(getCellValue(10)),
      actualDeliveryDate: this.parseDate(getCellValue(11)),
      deliveryAddress: getCellValue(8)?.toString().trim() || null,
      qtyDelivered: this.parseNumber(getCellValue(12)),
      outstandingQty: this.parseNumber(getCellValue(13)),
      customerInvoiceAmount: this.parseNumber(getCellValue(14)),
      price38: this.parseNumber(getCellValue(15)),
      price24: this.parseNumber(getCellValue(16)),
      status,
      actionRequired: getCellValue(18)?.toString().trim() || null,
      notes: null, // Can be populated from action required field
      ourCost: this.parseNumber(getCellValue(19)),
      commissionOnly,
      commissionAmount: this.parseNumber(getCellValue(21)),
      customerPODocumentPath: null, // Will be set later when mapping PDFs
    };

    return order;
  }

  /**
   * Parse customers from Excel file
   * @param filePath Path to "Customers EIN Included.xlsx"
   * @returns Array of source customer data
   */
  async parseCustomers(filePath: string): Promise<SourceCustomerData[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'Customers'; // Assuming sheet name
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName] || (firstSheetName ? workbook.Sheets[firstSheetName] : null);

    if (!sheet) {
      throw new Error(`No sheets found in customer workbook`);
    }

    const customers: SourceCustomerData[] = [];

    // Data starts at row 2 (0-indexed row 1), rows 2-7 = 6 customers
    for (let row = 2; row <= 7; row++) {
      const customer = this.parseCustomerRow(sheet, row);
      if (customer) {
        customers.push(customer);
      }
    }

    console.log(`✅ Parsed ${customers.length} customers`);

    return customers;
  }

  /**
   * Parse individual customer row
   * Column structure (0-indexed):
   * Col 0: Company Legal Name
   * Col 1-6: Billing Address
   * Col 7: Shipping Same as Billing?
   * Col 8-13: Shipping Address
   * Col 14: EIN
   * Col 15: Tax Exempt?
   * Col 16-18: Sales Contact
   * Col 19-22: Billing Contact
   * Col 23: Notes
   */
  private parseCustomerRow(sheet: XLSX.WorkSheet, row: number): SourceCustomerData | null {
    const getCellValue = (col: number): any => {
      const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col });
      const cell = sheet[cellAddress];
      return cell ? cell.v : null;
    };

    // Legal name and EIN are required
    const legalName = getCellValue(0)?.toString().trim();
    const ein = getCellValue(14)?.toString().trim();

    if (!legalName || !ein) {
      console.warn(`⚠️  Row ${row}: Missing legal name or EIN, skipping`);
      return null;
    }

    const shippingSame = getCellValue(7)?.toString().toUpperCase() === 'YES';

    const customer: SourceCustomerData = {
      legalName,
      ein: this.normalizeEIN(ein),
      taxExempt: getCellValue(15)?.toString().toUpperCase() === 'YES',
      billingAddress1: getCellValue(1)?.toString().trim() || null,
      billingAddress2: getCellValue(2)?.toString().trim() || null,
      billingCity: getCellValue(3)?.toString().trim() || null,
      billingState: getCellValue(4)?.toString().trim() || null,
      billingPostalCode: getCellValue(5)?.toString().trim() || null,
      billingCountry: getCellValue(6)?.toString().trim() || 'US',
      shippingSameAsBilling: shippingSame,
      shippingAddress1: shippingSame ? null : getCellValue(8)?.toString().trim() || null,
      shippingAddress2: shippingSame ? null : getCellValue(9)?.toString().trim() || null,
      shippingCity: shippingSame ? null : getCellValue(10)?.toString().trim() || null,
      shippingState: shippingSame ? null : getCellValue(11)?.toString().trim() || null,
      shippingPostalCode: shippingSame ? null : getCellValue(12)?.toString().trim() || null,
      shippingCountry: shippingSame ? null : getCellValue(13)?.toString().trim() || 'US',
      salesContactName: getCellValue(16)?.toString().trim() || null,
      salesContactEmail: getCellValue(17)?.toString().trim() || null,
      salesContactPhone: getCellValue(18)?.toString().trim() || null,
      billingContactName: getCellValue(19)?.toString().trim() || null,
      billingContactTitle: getCellValue(20)?.toString().trim() || null,
      billingContactEmail: getCellValue(21)?.toString().trim() || null,
      billingContactPhone: getCellValue(22)?.toString().trim() || null,
      notes: getCellValue(23)?.toString().trim() || null,
    };

    return customer;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Parse number from cell value (handles various formats)
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = typeof value === 'number' ? value : parseFloat(value.toString().replace(/[,$]/g, ''));
    return isNaN(num) ? null : num;
  }

  /**
   * Parse date from cell value (Excel dates are serial numbers)
   */
  private parseDate(value: any): Date | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Excel dates are serial numbers (days since 1900-01-01)
    if (typeof value === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
      return date;
    }

    // Try parsing as string
    const parsed = new Date(value.toString());
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Normalize status value
   */
  private normalizeStatus(status: string): 'INVOICED' | 'IN TRANSIT' | 'AVAILABLE' | 'OPEN' {
    const normalized = status.toUpperCase().trim();

    if (normalized.includes('INVOICE')) return 'INVOICED';
    if (normalized.includes('TRANSIT')) return 'IN TRANSIT';
    if (normalized.includes('AVAILABLE')) return 'AVAILABLE';

    return 'OPEN';
  }

  /**
   * Normalize EIN format (remove dashes/spaces)
   */
  private normalizeEIN(ein: string): string {
    // Remove all non-digit characters, then format as XX-XXXXXXX
    const digits = ein.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.substring(0, 2)}-${digits.substring(2)}`;
    }
    return ein; // Return as-is if not 9 digits
  }
}
