/**
 * Operations Dashboard Export Utilities
 *
 * Export dashboard data to Excel/CSV format.
 */

import type {
  OperationsData,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  CustomerCommitment,
  ImmediateAttentionItem,
  SKUBreakdown,
} from '../types';

// ============================================
// CSV HELPER FUNCTIONS
// ============================================

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(',');
  const dataRows = data.map((row) =>
    headers.map((h) => escapeCSV(row[h.key] as string | number | null)).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export Supplier Shipment Schedule to CSV
 */
export function exportSupplierSchedule(data: ShipmentScheduleItem[]): void {
  const headers: { key: keyof ShipmentScheduleItem; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'sku290_85R38Qty', label: '290/85R38 Qty' },
    { key: 'sku380_85R24Qty', label: '380/85R24 Qty' },
    { key: 'skuBeadLockQty', label: 'Bead Lock Qty' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'customer', label: 'Customer' },
    { key: 'po', label: 'PO' },
    { key: 'etaToUsPort', label: 'ETA to US Port' },
    { key: 'confirmedEta', label: 'Confirmed ETA' },
    { key: 'customerExpectedDelivery', label: 'Customer Expected Delivery' },
    { key: 'actualDeliveryDate', label: 'Actual Delivery Date' },
    { key: 'qtyDelivered', label: 'Qty Delivered' },
    { key: 'outstandingQtyForPO', label: 'Outstanding Qty' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
  ];

  const csv = toCSV(data, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `supplier-shipment-schedule-${date}.csv`);
}

/**
 * Export GDC1 Inventory to CSV
 */
export function exportGDC1Inventory(data: GDC1InventoryItem[]): void {
  const headers: { key: keyof GDC1InventoryItem; label: string }[] = [
    { key: 'no', label: 'No.' },
    { key: 'loadNumber', label: 'Load Number' },
    { key: 'sku290_85R38Qty', label: '290/85R38 Qty' },
    { key: 'sku380_85R24Qty', label: '380/85R24 Qty' },
    { key: 'skuBeadLockQty', label: 'Bead Lock Qty' },
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
    { key: 'price38', label: 'Price 38' },
    { key: 'price24', label: 'Price 24' },
    { key: 'payment50PercentDate', label: '50% Payment Date' },
    { key: 'remaining50DueDate', label: 'Remaining 50% Due' },
    { key: 'deliveryAddress', label: 'Delivery Address' },
    { key: 'status', label: 'Status' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'ankurNotes', label: 'Notes' },
  ];

  const csv = toCSV(data, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `gdc1-inventory-${date}.csv`);
}

/**
 * Export Customer Commitments to CSV
 */
export function exportCustomerCommitments(data: CustomerCommitment[]): void {
  const headers: { key: keyof CustomerCommitment; label: string }[] = [
    { key: 'customer', label: 'Customer' },
    { key: 'loads', label: 'Loads' },
    { key: 'outstandingQty', label: 'Outstanding Qty' },
    { key: 'invoiceAmount', label: 'Invoice Amount' },
    { key: 'inTransitNext7Days', label: 'In Transit Next 7 Days' },
  ];

  const csv = toCSV(data, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `customer-commitments-${date}.csv`);
}

/**
 * Export Immediate Attention Items to CSV
 */
export function exportImmediateAttention(data: ImmediateAttentionItem[]): void {
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

  const csv = toCSV(data, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `immediate-attention-${date}.csv`);
}

/**
 * Export SKU Breakdown to CSV
 */
export function exportSKUBreakdown(data: SKUBreakdown[]): void {
  const headers: { key: keyof SKUBreakdown; label: string }[] = [
    { key: 'skuName', label: 'SKU' },
    { key: 'supplierOutstandingQty', label: 'Supplier Outstanding' },
    { key: 'gdc1AvailableInventory', label: 'GDC1 Available' },
    { key: 'combinedQty', label: 'Combined Qty' },
    { key: 'shareOfCombined', label: 'Share %' },
  ];

  const csv = toCSV(data, headers);
  const date = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `sku-breakdown-${date}.csv`);
}

/**
 * Export all data to multiple CSV files (as ZIP would require additional library)
 * For now, exports the main schedule which is what Jenny uses most
 */
export function exportAllData(data: OperationsData): void {
  // Export the main sheets Jenny uses
  exportSupplierSchedule(data.supplierShipmentSchedule);

  // Slight delay to avoid browser blocking multiple downloads
  setTimeout(() => {
    exportGDC1Inventory(data.gdc1Inventory);
  }, 500);
}

/**
 * Export options dialog helper
 */
export type ExportType =
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'customer-commitments'
  | 'immediate-attention'
  | 'sku-breakdown'
  | 'all';

export function exportByType(type: ExportType, data: OperationsData): void {
  switch (type) {
    case 'supplier-schedule':
      exportSupplierSchedule(data.supplierShipmentSchedule);
      break;
    case 'gdc1-inventory':
      exportGDC1Inventory(data.gdc1Inventory);
      break;
    case 'customer-commitments':
      exportCustomerCommitments(data.customerCommitments);
      break;
    case 'immediate-attention':
      exportImmediateAttention(data.immediateAttention);
      break;
    case 'sku-breakdown':
      exportSKUBreakdown(data.skuBreakdown);
      break;
    case 'all':
      exportAllData(data);
      break;
  }
}
