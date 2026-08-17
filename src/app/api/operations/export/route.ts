/**
 * Operations Dashboard XLSX Export API
 *
 * Server-side route that generates XLSX with native Excel charts.
 * Uses xlsx-chart library which requires Node.js environment.
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import type { OperationsData } from '@/features/operations-dashboard/types';
import { getOperationsData } from '@/features/operations-dashboard/services';

// ============================================
// STYLE DEFINITIONS
// ============================================

const COLORS = {
  darkBlue: 'FF1E3A5F',
  lightBlue: 'FFD6EAF8',
  mediumBlue: 'FF2E86AB',
  green: 'FF27AE60',
  orange: 'FFF39C12',
  red: 'FFCB4335',
  white: 'FFFFFFFF',
  lightGray: 'FFF5F5F5',
  borderGray: 'FFD5D8DC',
  textDark: 'FF2C3E50',
  textLight: 'FFFFFFFF',
};

const FONTS = {
  headerTitle: { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.textLight } },
  sectionHeader: { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.textLight } },
  kpiLabel: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
  kpiValue: { name: 'Calibri', size: 24, bold: true, color: { argb: COLORS.textDark } },
  tableHeader: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.textLight } },
  tableCell: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
  storyText: { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } },
};

const BORDERS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.borderGray } },
  left: { style: 'thin', color: { argb: COLORS.borderGray } },
  bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
  right: { style: 'thin', color: { argb: COLORS.borderGray } },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) { return ''; }
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function setColumnWidths(worksheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

function applyFill(cell: ExcelJS.Cell, color: string): void {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

function mergeAndStyle(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  value: string | number,
  font: Partial<ExcelJS.Font>,
  fillColor: string,
  alignment?: Partial<ExcelJS.Alignment>
): void {
  worksheet.mergeCells(startRow, startCol, endRow, endCol);
  const cell = worksheet.getCell(startRow, startCol);
  cell.value = value;
  cell.font = font;
  applyFill(cell, fillColor);
  cell.alignment = alignment || { vertical: 'middle', horizontal: 'center' };
  cell.border = BORDERS;
}

// ============================================
// EXECUTIVE SUMMARY SHEET
// ============================================

function createExecutiveSummarySheet(
  workbook: ExcelJS.Workbook,
  data: OperationsData
): {
  skuDataRange: { start: number; end: number };
  statusDataRange: { start: number; end: number };
} {
  const ws = workbook.addWorksheet('Executive Summary');

  // Set column widths: A-G for data, H as spacer, I-J for charts
  setColumnWidths(ws, [20, 25, 25, 18, 18, 18, 18, 5, 35, 15]);

  let currentRow = 1;

  // ============================================
  // MAIN HEADER
  // ============================================
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 10,
    'Executive Summary - Galileo / GDC Inventory & Shipments',
    FONTS.headerTitle,
    COLORS.darkBlue
  );
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // ============================================
  // KPI CARDS ROW
  // ============================================
  const kpis = [
    { label: 'Available inventory qty', value: formatNumber(data.stats.availableInventoryQty) },
    { label: 'Available loads', value: formatNumber(data.stats.availableLoads) },
    { label: 'Available inventory value', value: formatCurrency(data.stats.availableInventoryValue) },
    { label: 'Committed customer qty', value: formatNumber(data.stats.committedCustomerQty) },
  ];

  // KPI Labels row
  ws.getRow(currentRow).height = 20;
  kpis.forEach((kpi, index) => {
    const col = index === 0 ? 1 : (index === 1 ? 3 : (index === 2 ? 5 : 7));
    const cell = ws.getCell(currentRow, col);
    cell.value = kpi.label;
    cell.font = FONTS.kpiLabel;
    applyFill(cell, COLORS.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    if (index < 3) {
      ws.mergeCells(currentRow, col, currentRow, col + 1);
    }
  });
  currentRow++;

  // KPI Values row
  ws.getRow(currentRow).height = 40;
  kpis.forEach((kpi, index) => {
    const col = index === 0 ? 1 : (index === 1 ? 3 : (index === 2 ? 5 : 7));
    const cell = ws.getCell(currentRow, col);
    cell.value = kpi.value;
    cell.font = FONTS.kpiValue;
    applyFill(cell, COLORS.lightBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
    if (index < 3) {
      ws.mergeCells(currentRow, col, currentRow, col + 1);
    }
  });
  currentRow += 2;

  // ============================================
  // STORY IN BRIEF
  // ============================================
  mergeAndStyle(ws, currentRow, 1, currentRow, 7, 'STORY IN BRIEF', FONTS.sectionHeader, COLORS.red);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  mergeAndStyle(
    ws, currentRow, 1, currentRow + 1, 7,
    data.storyInBrief || 'No story available.',
    FONTS.storyText,
    COLORS.white,
    { vertical: 'top', horizontal: 'left', wrapText: true }
  );
  ws.getRow(currentRow).height = 50;
  currentRow += 3;

  // ============================================
  // SKU QUANTITY BREAKDOWN
  // ============================================

  // Section header
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 5,
    'SKU QUANTITY BREAKDOWN - GALILEO + GDC1 INVENTORY',
    FONTS.sectionHeader,
    COLORS.green
  );
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const skuHeaders = ['SKU', 'Galileo Outstanding Qty', 'GDC1 Available Inventory', 'Combined Qty', 'Share of Combined'];
  skuHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.green);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  const skuDataStartRow = currentRow;
  data.skuBreakdown.forEach((sku, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [
      sku.skuName || sku.sku,
      sku.supplierOutstandingQty,
      sku.gdc1AvailableInventory,
      sku.combinedQty,
      formatPercent(sku.shareOfCombined),
    ];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex >= 1 && colIndex <= 3 && typeof value === 'number') {
        cell.numFmt = '#,##0';
      }
    });
    currentRow++;
  });
  const skuDataEndRow = currentRow - 1;

  currentRow += 2;

  // ============================================
  // CUSTOMER COMMITMENTS
  // ============================================
  mergeAndStyle(
    ws, currentRow, 1, currentRow, 4,
    'CUSTOMER COMMITMENTS / OUTSTANDING',
    FONTS.sectionHeader,
    COLORS.mediumBlue
  );
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const customerHeaders = ['Customer', 'Outstanding Qty', 'Invoice Amount', 'Loads'];
  customerHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.mediumBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  data.customerCommitments.forEach((customer, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [customer.customer, customer.outstandingQty, customer.invoiceAmount, customer.loads];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex === 1 || colIndex === 3) {
        cell.numFmt = '#,##0';
      } else if (colIndex === 2) {
        cell.numFmt = '$#,##0';
      }
    });
    currentRow++;
  });

  currentRow += 2;

  // ============================================
  // SHIPMENT STATUS MIX
  // ============================================

  mergeAndStyle(
    ws, currentRow, 1, currentRow, 3,
    'SHIPMENT / INVENTORY STATUS MIX',
    FONTS.sectionHeader,
    COLORS.orange
  );
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const statusHeaders = ['Status', 'Loads', 'Units'];
  statusHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.orange);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  const statusDataStartRow = currentRow;
  data.shipmentStatusMix.forEach((status, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [status.status.replace('_', ' '), status.loads, status.qty];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex >= 1) {
        cell.numFmt = '#,##0';
      }
    });
    currentRow++;
  });
  const statusDataEndRow = currentRow - 1;

  return {
    skuDataRange: { start: skuDataStartRow, end: skuDataEndRow },
    statusDataRange: { start: statusDataStartRow, end: statusDataEndRow },
  };
}

// ============================================
// SHIPMENT OVERVIEW SHEET
// ============================================

function createShipmentOverviewSheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('Shipment Overview');
  setColumnWidths(ws, [15, 15, 15, 12, 15, 18, 15, 35]);

  let currentRow = 1;

  mergeAndStyle(ws, currentRow, 1, currentRow, 8, 'Shipment Overview', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  const summaryKpis = [
    { label: 'In transit / next 7 day', value: data.stats.inTransitNext7Days },
    { label: 'Open loads', value: data.stats.openLoads },
    { label: 'Outstanding Qty', value: data.stats.outstandingQty },
    { label: 'Invoice amount', value: formatCurrency(data.stats.invoiceAmount) },
  ];

  let col = 1;
  summaryKpis.forEach((kpi) => {
    ws.getCell(currentRow, col).value = kpi.label;
    ws.getCell(currentRow, col).font = FONTS.kpiLabel;
    applyFill(ws.getCell(currentRow, col), COLORS.lightBlue);
    ws.getCell(currentRow, col + 1).value = typeof kpi.value === 'number' ? kpi.value : kpi.value;
    ws.getCell(currentRow, col + 1).font = { ...FONTS.kpiValue, size: 16 };
    applyFill(ws.getCell(currentRow, col + 1), COLORS.lightBlue);
    ws.getCell(currentRow, col + 1).alignment = { horizontal: 'right' };
    col += 2;
  });
  ws.getRow(currentRow).height = 30;
  currentRow += 2;

  // Immediate Attention Section
  mergeAndStyle(ws, currentRow, 1, currentRow, 8, 'IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS', FONTS.sectionHeader, COLORS.red);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const attentionHeaders = ['Load #', 'Customer', 'PO', 'Qty', 'ETA Port', 'Customer ETA/Due', 'Status', 'Action Required / Notes'];
  attentionHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.red);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  const inTransitItems = data.immediateAttention.filter(item => item.status === 'IN_TRANSIT' || item.isThisWeek);
  inTransitItems.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [item.loadNumber, item.customer, item.po, item.qty, formatDate(item.etaPort), formatDate(item.customerEtaDue), item.status.replace('_', ' '), item.actionRequired];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 3 ? 'right' : 'left', vertical: 'middle', wrapText: colIndex === 7 };
      cell.border = BORDERS;
      if (colIndex === 3) { cell.numFmt = '#,##0'; }
    });
    currentRow++;
  });

  currentRow += 2;

  // Customer Summary
  mergeAndStyle(ws, currentRow, 1, currentRow, 5, 'CUSTOMER SUMMARY', FONTS.sectionHeader, COLORS.darkBlue);
  ws.getRow(currentRow).height = 22;
  currentRow++;

  const customerSummaryHeaders = ['Customer', 'Loads', 'Outstanding Qty', 'Invoice Amount', 'In Transit / Next 7 Days'];
  customerSummaryHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.darkBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 20;
  currentRow++;

  data.customerCommitments.forEach((customer, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const row = [customer.customer, customer.loads, customer.outstandingQty, customer.invoiceAmount, customer.inTransitNext7Days];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'right', vertical: 'middle' };
      cell.border = BORDERS;
      if (colIndex === 1 || colIndex === 2 || colIndex === 4) { cell.numFmt = '#,##0'; }
      else if (colIndex === 3) { cell.numFmt = '$#,##0'; }
    });
    currentRow++;
  });
}

// ============================================
// SUPPLIER SCHEDULE SHEET
// ============================================

function createSupplierScheduleSheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('Shipment Schedule Galileo');
  setColumnWidths(ws, [12, 15, 25, 10, 15, 15, 15, 15, 15, 12, 12, 30, 12, 30]);

  let currentRow = 1;

  mergeAndStyle(ws, currentRow, 1, currentRow, 14, 'Supplier Shipment Schedule - Galileo', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  const headers = ['No.', 'Load Number', 'Items', 'Total Qty', 'Customer', 'PO', 'ETA to US Port', 'Confirmed ETA', 'Customer Expected', 'Actual Delivery', 'Qty Delivered', 'Outstanding Qty', 'Status', 'Action Required'];
  headers.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.darkBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 25;
  currentRow++;

  data.supplierShipmentSchedule.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const itemsStr = item.items.map(i => `${i.sku}: ${i.qty}`).join(', ');
    const row = [item.no, item.loadNumber, itemsStr, item.totalQty, item.customer, item.po, formatDate(item.etaToUsPort), formatDate(item.confirmedEta), formatDate(item.customerExpectedDelivery), formatDate(item.actualDeliveryDate), item.qtyDelivered, item.outstandingQtyForPO, item.status.replace('_', ' '), item.actionRequired];
    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      cell.alignment = { horizontal: [0, 3, 10, 11].includes(colIndex) ? 'right' : 'left', vertical: 'middle', wrapText: [2, 13].includes(colIndex) };
      cell.border = BORDERS;
      if ([0, 3, 10, 11].includes(colIndex)) { cell.numFmt = '#,##0'; }
    });
    currentRow++;
  });
}

// ============================================
// GDC1 INVENTORY SHEET
// ============================================

function createGDC1InventorySheet(workbook: ExcelJS.Workbook, data: OperationsData): void {
  const ws = workbook.addWorksheet('GDC 1');
  setColumnWidths(ws, [8, 15, 25, 10, 15, 12, 12, 15, 12, 12, 12, 10, 10, 12, 12, 10, 10, 12, 12, 12, 25, 25]);

  let currentRow = 1;

  mergeAndStyle(ws, currentRow, 1, currentRow, 22, 'GDC1 Inventory', FONTS.headerTitle, COLORS.darkBlue);
  ws.getRow(currentRow).height = 35;
  currentRow++;

  // Build dynamic headers - add price columns for each SKU
  const baseHeaders = ['No.', 'Load #', 'Items', 'Total Qty', 'Customer', 'PO', 'ETA Port', 'Delivery Address', 'Confirmed ETA', 'Customer Expected', 'Actual Delivery', 'Qty Del.', 'Outstanding', 'Invoice #', 'Invoice Amt'];
  // Get unique SKUs for dynamic price columns
  const skuSet = new Set<string>();
  data.gdc1Inventory.forEach(item => item.items.forEach(i => skuSet.add(i.sku)));
  const uniqueSkus = Array.from(skuSet).sort();
  const priceHeaders = uniqueSkus.map(sku => `${sku} Price`);
  const endHeaders = ['50% Payment', '50% Due', 'Status', 'Action / Notes', 'Ankur Comments'];
  const headers = [...baseHeaders, ...priceHeaders, ...endHeaders];

  headers.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = FONTS.tableHeader;
    applyFill(cell, COLORS.darkBlue);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDERS;
  });
  ws.getRow(currentRow).height = 25;
  currentRow++;

  data.gdc1Inventory.forEach((item, index) => {
    const rowColor = index % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const itemsStr = item.items.map(i => `${i.sku}: ${i.qty}`).join(', ');

    // Build base row data
    const baseRow = [
      item.no,
      item.loadNumber,
      itemsStr,
      item.totalQty,
      item.customer || '',
      item.po || '',
      formatDate(item.etaToUsPort),
      item.deliveryAddress || '',
      formatDate(item.confirmedEta),
      formatDate(item.customerExpectedDelivery),
      formatDate(item.actualDelivery),
      item.qtyDelivered,
      item.outstandingPoQty,
      item.invoiceNumber || '',
      item.invoiceAmount
    ];

    // Add dynamic price columns for each SKU
    const priceRow = uniqueSkus.map(sku => {
      const skuItem = item.items.find(i => i.sku === sku);
      return skuItem?.unitPrice || '';
    });

    const endRow = [
      formatDate(item.payment50PercentDate),
      formatDate(item.remaining50DueDate),
      item.status.replace('_', ' '),
      item.actionRequired,
      item.ankurNotes
    ];

    const row = [...baseRow, ...priceRow, ...endRow];

    row.forEach((value, colIndex) => {
      const cell = ws.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = FONTS.tableCell;
      applyFill(cell, rowColor);
      // Adjust alignment indexes for dynamic columns
      const priceColStart = 15;
      const priceColEnd = priceColStart + uniqueSkus.length;
      const isNumeric = [0, 3, 11, 12].includes(colIndex);
      const isCurrency = colIndex === 14 || (colIndex >= priceColStart && colIndex < priceColEnd);
      cell.alignment = { horizontal: isNumeric || isCurrency ? 'right' : 'left', vertical: 'middle', wrapText: [2, 7].includes(colIndex) || colIndex >= priceColEnd + 2 };
      cell.border = BORDERS;
      if (isNumeric) { cell.numFmt = '#,##0'; }
      else if (isCurrency) { cell.numFmt = '$#,##0'; }
    });
    currentRow++;
  });
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exportType = searchParams.get('type') || 'all';

    // Fetch operations data
    const data = await getOperationsData();

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gesher Distribution';
    workbook.created = new Date();

    // Create sheets based on export type
    if (exportType === 'all' || exportType === 'executive-summary') {
      createExecutiveSummarySheet(workbook, data);
    }

    if (exportType === 'all' || exportType === 'shipment-overview') {
      createShipmentOverviewSheet(workbook, data);
    }

    if (exportType === 'all' || exportType === 'supplier-schedule') {
      createSupplierScheduleSheet(workbook, data);
    }

    if (exportType === 'all' || exportType === 'gdc1-inventory') {
      createGDC1InventorySheet(workbook, data);
    }

    // Generate buffer
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Note: Chart injection is disabled because Google Sheets has limited support
    // for OOXML embedded charts. Users can create charts manually from the data tables.

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = exportType === 'all'
      ? `operations-dashboard-${dateStr}.xlsx`
      : `${exportType}-${dateStr}.xlsx`;

    // Return response with XLSX file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
