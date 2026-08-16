/**
 * Operations Dashboard XLSX Export Utility
 *
 * Generates Excel workbooks with multiple sheets for dashboard data.
 */

import * as XLSX from 'xlsx';
import type {
  OperationsData,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  CustomerCommitment,
  ImmediateAttentionItem,
  SKUBreakdown,
  OperationsStats,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface XLSXExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format date for filename
 */
function getDateStr(): string {
  return new Date().toISOString().split('T')[0] || new Date().toISOString().slice(0, 10);
}

/**
 * Format items array for Excel cell
 */
function formatItems(items: { sku: string; qty: number }[] | undefined): string {
  if (!items || items.length === 0) { return ''; }
  return items.map(item => `${item.sku || ''}: ${item.qty}`).join(', ');
}

/**
 * Create a worksheet from data array
 */
function createWorksheet<T extends Record<string, unknown>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): XLSX.WorkSheet {
  // Create header row
  const headerRow = headers.map(h => h.label);

  // Create data rows
  const dataRows = data.map(row =>
    headers.map(h => {
      const value = row[h.key];
      // Handle special cases
      if (value === null || value === undefined) { return ''; }
      if (typeof value === 'boolean') { return value ? 'Yes' : 'No'; }
      return value;
    })
  );

  // Combine header and data
  const wsData = [headerRow, ...dataRows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = headers.map(h => ({
    wch: Math.max(h.label.length, 15)
  }));
  ws['!cols'] = colWidths;

  return ws;
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export Supplier Shipment Schedule to sheet
 */
function createSupplierScheduleSheet(data: ShipmentScheduleItem[]): XLSX.WorkSheet {
  const transformedData = data.map(item => ({
    ...item,
    itemsDisplay: formatItems(item.items),
  }));

  const headers: { key: keyof typeof transformedData[0]; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'itemsDisplay', label: 'Items' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'etaToUsPort', label: 'ETA to US Port' },
    { key: 'confirmedEta', label: 'Confirmed ETA' },
    { key: 'customerExpectedDelivery', label: 'Customer Expected' },
    { key: 'actualDeliveryDate', label: 'Actual Delivery' },
    { key: 'qtyDelivered', label: 'Qty Delivered' },
    { key: 'outstandingQtyForPO', label: 'Outstanding Qty' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
  ];

  return createWorksheet(transformedData, headers);
}

/**
 * Export GDC1 Inventory to sheet
 */
function createGDC1InventorySheet(data: GDC1InventoryItem[]): XLSX.WorkSheet {
  const transformedData = data.map(item => ({
    ...item,
    itemsDisplay: formatItems(item.items),
  }));

  const headers: { key: keyof typeof transformedData[0]; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'itemsDisplay', label: 'Items' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'customerShipWindow', label: 'Ship Window' },
    { key: 'etaToUsPort', label: 'ETA to US Port' },
    { key: 'customerDueDate', label: 'Customer Due Date' },
    { key: 'actualDelivery', label: 'Actual Delivery' },
    { key: 'qtyDelivered', label: 'Qty Delivered' },
    { key: 'outstandingPoQty', label: 'Outstanding Qty' },
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'invoiceAmount', label: 'Invoice Amount' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'ankurNotes', label: 'Notes' },
  ];

  return createWorksheet(transformedData, headers);
}

/**
 * Export Immediate Attention to sheet
 */
function createImmediateAttentionSheet(data: ImmediateAttentionItem[]): XLSX.WorkSheet {
  const headers: { key: keyof ImmediateAttentionItem; label: string }[] = [
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'qty', label: 'Qty' },
    { key: 'etaPort', label: 'ETA Port' },
    { key: 'customerEtaDue', label: 'Customer ETA Due' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'isOverdue', label: 'Overdue' },
    { key: 'isThisWeek', label: 'This Week' },
  ];

  return createWorksheet(data as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
}

/**
 * Export SKU Breakdown to sheet
 */
function createSKUBreakdownSheet(data: SKUBreakdown[]): XLSX.WorkSheet {
  const headers: { key: keyof SKUBreakdown; label: string }[] = [
    { key: 'skuName', label: 'SKU' },
    { key: 'supplierOutstandingQty', label: 'Supplier Outstanding' },
    { key: 'gdc1AvailableInventory', label: 'GDC1 Available' },
    { key: 'combinedQty', label: 'Combined Qty' },
    { key: 'shareOfCombined', label: 'Share %' },
  ];

  return createWorksheet(data as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
}

/**
 * Export Customer Commitments to sheet
 */
function createCustomerCommitmentsSheet(data: CustomerCommitment[]): XLSX.WorkSheet {
  const headers: { key: keyof CustomerCommitment; label: string }[] = [
    { key: 'customer', label: 'Customer' },
    { key: 'loads', label: 'Loads' },
    { key: 'outstandingQty', label: 'Outstanding Qty' },
    { key: 'invoiceAmount', label: 'Invoice Amount' },
    { key: 'inTransitNext7Days', label: 'In Transit Next 7 Days' },
  ];

  return createWorksheet(data as unknown as Record<string, unknown>[], headers as { key: string; label: string }[]);
}

/**
 * Create Summary sheet with KPI data
 */
function createSummarySheet(stats: OperationsStats, storyInBrief: string): XLSX.WorkSheet {
  const date = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const summaryData = [
    ['Operations Dashboard Summary'],
    [`Generated: ${date}`],
    [''],
    ['Key Performance Indicators'],
    ['Metric', 'Value'],
    ['Available Inventory', `${stats.availableInventoryQty} units`],
    ['Available Loads', `${stats.availableLoads} loads`],
    ['Inventory Value', `$${stats.availableInventoryValue.toLocaleString()}`],
    ['Customer Committed', `${stats.committedCustomerQty} units`],
    ['In Transit / Next 7 Days', `${stats.inTransitNext7Days} loads`],
    [''],
    ['Story in Brief'],
    [storyInBrief],
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  ws['!cols'] = [{ wch: 25 }, { wch: 50 }];

  return ws;
}

// ============================================
// MAIN EXPORT FUNCTIONS
// ============================================

/**
 * Export full dashboard to XLSX with multiple sheets
 */
export function exportDashboardToXLSX(
  data: OperationsData,
  options: XLSXExportOptions = {}
): void {
  const {
    filename = 'operations-dashboard',
    includeTimestamp = true,
  } = options;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add Summary sheet
  const summarySheet = createSummarySheet(data.stats, data.storyInBrief);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Add Immediate Attention sheet
  const attentionSheet = createImmediateAttentionSheet(data.immediateAttention);
  XLSX.utils.book_append_sheet(wb, attentionSheet, 'Immediate Attention');

  // Add SKU Breakdown sheet
  const skuSheet = createSKUBreakdownSheet(data.skuBreakdown);
  XLSX.utils.book_append_sheet(wb, skuSheet, 'SKU Breakdown');

  // Add Customer Commitments sheet
  const customerSheet = createCustomerCommitmentsSheet(data.customerCommitments);
  XLSX.utils.book_append_sheet(wb, customerSheet, 'Customer Commitments');

  // Add Supplier Schedule sheet
  const supplierSheet = createSupplierScheduleSheet(data.supplierShipmentSchedule);
  XLSX.utils.book_append_sheet(wb, supplierSheet, 'Supplier Schedule');

  // Add GDC1 Inventory sheet
  const gdc1Sheet = createGDC1InventorySheet(data.gdc1Inventory);
  XLSX.utils.book_append_sheet(wb, gdc1Sheet, 'GDC1 Inventory');

  // Generate filename
  const dateStr = includeTimestamp ? `-${getDateStr()}` : '';
  const finalFilename = `${filename}${dateStr}.xlsx`;

  // Download
  XLSX.writeFile(wb, finalFilename);
}

/**
 * Export Executive Summary tab to XLSX
 */
export function exportExecutiveSummaryToXLSX(
  data: OperationsData,
  options: XLSXExportOptions = {}
): void {
  const { filename = 'executive-summary' } = options;

  const wb = XLSX.utils.book_new();

  // Summary
  const summarySheet = createSummarySheet(data.stats, data.storyInBrief);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Immediate Attention
  const attentionSheet = createImmediateAttentionSheet(data.immediateAttention);
  XLSX.utils.book_append_sheet(wb, attentionSheet, 'Immediate Attention');

  // SKU Breakdown
  const skuSheet = createSKUBreakdownSheet(data.skuBreakdown);
  XLSX.utils.book_append_sheet(wb, skuSheet, 'SKU Breakdown');

  // Customer Commitments
  const customerSheet = createCustomerCommitmentsSheet(data.customerCommitments);
  XLSX.utils.book_append_sheet(wb, customerSheet, 'Customer Commitments');

  const dateStr = getDateStr();
  XLSX.writeFile(wb, `${filename}-${dateStr}.xlsx`);
}

/**
 * Export Shipment Overview tab to XLSX
 */
export function exportShipmentOverviewToXLSX(
  data: OperationsData,
  options: XLSXExportOptions = {}
): void {
  const { filename = 'shipment-overview' } = options;

  const wb = XLSX.utils.book_new();

  // In Transit items
  const attentionSheet = createImmediateAttentionSheet(data.immediateAttention);
  XLSX.utils.book_append_sheet(wb, attentionSheet, 'In Transit');

  // Customer Commitments
  const customerSheet = createCustomerCommitmentsSheet(data.customerCommitments);
  XLSX.utils.book_append_sheet(wb, customerSheet, 'Customer Summary');

  const dateStr = getDateStr();
  XLSX.writeFile(wb, `${filename}-${dateStr}.xlsx`);
}

/**
 * Export Supplier Schedule tab to XLSX
 */
export function exportSupplierScheduleToXLSX(
  data: OperationsData,
  options: XLSXExportOptions = {}
): void {
  const { filename = 'supplier-schedule' } = options;

  const wb = XLSX.utils.book_new();

  const supplierSheet = createSupplierScheduleSheet(data.supplierShipmentSchedule);
  XLSX.utils.book_append_sheet(wb, supplierSheet, 'Supplier Schedule');

  const dateStr = getDateStr();
  XLSX.writeFile(wb, `${filename}-${dateStr}.xlsx`);
}

/**
 * Export GDC1 Inventory tab to XLSX
 */
export function exportGDC1InventoryToXLSX(
  data: OperationsData,
  options: XLSXExportOptions = {}
): void {
  const { filename = 'gdc1-inventory' } = options;

  const wb = XLSX.utils.book_new();

  const gdc1Sheet = createGDC1InventorySheet(data.gdc1Inventory);
  XLSX.utils.book_append_sheet(wb, gdc1Sheet, 'GDC1 Inventory');

  const dateStr = getDateStr();
  XLSX.writeFile(wb, `${filename}-${dateStr}.xlsx`);
}

/**
 * Export by type
 */
export type XLSXExportType =
  | 'executive-summary'
  | 'shipment-overview'
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'all';

export function exportToXLSX(type: XLSXExportType, data: OperationsData): void {
  switch (type) {
    case 'executive-summary':
      exportExecutiveSummaryToXLSX(data);
      break;
    case 'shipment-overview':
      exportShipmentOverviewToXLSX(data);
      break;
    case 'supplier-schedule':
      exportSupplierScheduleToXLSX(data);
      break;
    case 'gdc1-inventory':
      exportGDC1InventoryToXLSX(data);
      break;
    case 'all':
      exportDashboardToXLSX(data);
      break;
  }
}
