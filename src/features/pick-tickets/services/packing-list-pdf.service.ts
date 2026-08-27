/**
 * Packing List PDF Service
 *
 * Generates PDF from packing list data using the shared Puppeteer renderer.
 * Uses the Gesher Distribution theme template, matching the pick ticket PDF.
 */

import { htmlToPdfBase64 } from '@/shared/lib/pdf';

export interface PackingListPdfData {
  packingListNumber: string;
  createdAt: string;
  status: string;
  packedAt: string | null;
  packedBy: string | null;

  pickTicketNumber: string;
  salesOrderNumber: string;
  customerName: string;
  customerPoNumber: string | null;
  shipToAddress: string;
  shipmentNumber: string | null;

  totalPackages: number;
  totalWeight: number | null;
  weightUnit: string;

  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    packageNumber: number;
    quantityPacked: number;
    weight: number | null;
  }>;
  notes?: string | null;
}

/**
 * Generate Packing List PDF
 * Returns base64 encoded PDF
 */
export async function generatePackingListPdf(
  data: PackingListPdfData
): Promise<string> {
  return htmlToPdfBase64(generatePackingListHtml(data));
}

/**
 * Escape values that come from user input before dropping them into the
 * HTML template.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate HTML from packing list data using Gesher Distribution theme
 */
function generatePackingListHtml(data: PackingListPdfData): string {
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) {
      return '-';
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatWeight = (weight: number | null): string =>
    weight === null ? '-' : `${weight} ${escapeHtml(data.weightUnit)}`;

  const totalQty = data.items.reduce((sum, item) => sum + item.quantityPacked, 0);
  const totalLines = data.items.length;

  // Group the rows by package so the warehouse can check off one box at a time.
  const packageNumbers = Array.from(
    new Set(data.items.map((item) => item.packageNumber))
  ).sort((a, b) => a - b);

  const packageSections = packageNumbers
    .map((packageNumber) => {
      const packageItems = data.items.filter(
        (item) => item.packageNumber === packageNumber
      );
      const packageQty = packageItems.reduce(
        (sum, item) => sum + item.quantityPacked,
        0
      );

      const rows = packageItems
        .map(
          (item) => `
    <tr>
      <td><div class="row-num">${item.rowNum}</div></td>
      <td><span class="sku">${escapeHtml(item.sku)}</span></td>
      <td class="product-name">${escapeHtml(item.productName)}</td>
      <td class="qty-cell">${item.quantityPacked}</td>
      <td class="weight-cell">${formatWeight(item.weight)}</td>
      <td class="checkbox-cell"><span class="checkbox"></span></td>
    </tr>
  `
        )
        .join('');

      return `
    <div class="package-block">
      <div class="package-header">
        <span class="package-badge">Package ${packageNumber}</span>
        <span class="package-meta">${packageItems.length} line${packageItems.length === 1 ? '' : 's'} &middot; ${packageQty} unit${packageQty === 1 ? '' : 's'}</span>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 120px;">SKU</th>
            <th>Product Name</th>
            <th style="width: 70px;">Qty</th>
            <th style="width: 90px;">Weight</th>
            <th style="width: 70px;">Checked</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing List - ${escapeHtml(data.packingListNumber)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* Gesher Distribution Theme Colors */
    :root {
      --primary: #23604c;
      --primary-light: #359a6e;
      --primary-dark: #1a4a3a;
      --background: #f8f6f1;
      --card: #fdfcfa;
      --foreground: #1f3d35;
      --muted: #677572;
      --border: #e6e3dc;
      --accent: #e8f0ed;
      --success: #359a6e;
      --warning: #e29914;
      --danger: #c92828;
    }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: var(--foreground);
      padding: 0;
      margin: 0;
      background: white;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      padding: 30px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      margin-bottom: 25px;
      border-bottom: 3px solid var(--primary);
    }

    .company-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .logo {
      width: 60px;
      height: 60px;
      background: var(--primary);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
    }

    .company-info h1 {
      font-size: 22px;
      color: var(--primary);
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }

    .company-info p {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.5;
    }

    .ticket-info {
      text-align: right;
    }

    .document-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      margin-bottom: 5px;
    }

    .ticket-number {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .ticket-meta {
      font-size: 11px;
      color: var(--muted);
    }

    .status-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--accent);
      color: var(--primary);
      border: 1px solid var(--border);
    }

    /* Info Cards */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }

    .info-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
    }

    .info-card h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--primary);
      margin-bottom: 12px;
      font-weight: 600;
    }

    .info-row {
      display: flex;
      margin-bottom: 8px;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-label {
      width: 105px;
      font-size: 11px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .info-value {
      font-size: 12px;
      color: var(--foreground);
      font-weight: 500;
    }

    /* Items Section */
    .items-section {
      margin-bottom: 20px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--accent);
    }

    .section-icon {
      width: 28px;
      height: 28px;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      font-size: 14px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--foreground);
    }

    /* Package blocks */
    .package-block {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .package-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .package-badge {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 14px;
      border-radius: 6px;
    }

    .package-meta {
      font-size: 11px;
      color: var(--muted);
    }

    /* Table */
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .items-table th {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .items-table th:first-child {
      padding-left: 15px;
    }

    .items-table td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      vertical-align: middle;
    }

    .items-table td:first-child {
      padding-left: 15px;
    }

    .items-table tr:last-child td {
      border-bottom: none;
    }

    .items-table tr:nth-child(even) {
      background-color: var(--card);
    }

    .row-num {
      width: 30px;
      height: 30px;
      background: var(--accent);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: var(--primary);
      font-size: 11px;
    }

    .sku {
      font-family: 'Consolas', monospace;
      font-size: 11px;
      color: var(--muted);
      background: var(--accent);
      padding: 3px 8px;
      border-radius: 4px;
    }

    .product-name {
      font-weight: 500;
    }

    .qty-cell {
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      color: var(--primary);
    }

    .weight-cell {
      text-align: center;
      color: var(--muted);
      font-size: 11px;
    }

    .checkbox-cell {
      text-align: center;
    }

    .checkbox {
      width: 22px;
      height: 22px;
      border: 2px solid var(--primary);
      border-radius: 4px;
      display: inline-block;
      background: white;
    }

    /* Summary */
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 25px;
    }

    .summary-cards {
      display: flex;
      gap: 15px;
    }

    .summary-card {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      border-radius: 10px;
      padding: 15px 25px;
      text-align: center;
      color: white;
      min-width: 100px;
    }

    .summary-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
      margin-bottom: 5px;
    }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
    }

    /* Notes Section */
    .notes-section {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1px solid #fcd34d;
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 30px;
    }

    .notes-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .notes-icon {
      font-size: 16px;
    }

    .notes-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #92400e;
      font-weight: 600;
    }

    .notes-text {
      color: #78350f;
      font-size: 12px;
      line-height: 1.6;
    }

    /* Signature Section */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      padding-top: 25px;
      border-top: 2px solid var(--border);
      margin-bottom: 25px;
    }

    .signature-box {
      text-align: center;
    }

    .signature-line {
      border-bottom: 2px solid var(--foreground);
      height: 50px;
      margin-bottom: 10px;
      background: linear-gradient(to bottom, transparent 90%, var(--accent) 100%);
    }

    .signature-label {
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    .footer-text {
      color: var(--muted);
      font-size: 10px;
      margin-bottom: 3px;
    }

    .footer-brand {
      color: var(--primary);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="company-section">
        <div class="logo">GD</div>
        <div class="company-info">
          <h1>GESHER DISTRIBUTION</h1>
          <p>8700 Commerce Park Dr, Houston, TX 77036<br>
          Phone: (713) 555-8200 | operations@gesherdist.com</p>
        </div>
      </div>
      <div class="ticket-info">
        <div class="document-type">Packing List</div>
        <div class="ticket-number">${escapeHtml(data.packingListNumber)}</div>
        <div class="ticket-meta">Created: ${formatDate(data.createdAt)}</div>
        <div class="status-badge">${escapeHtml(data.status)}</div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-grid">
      <div class="info-card">
        <h3>Order Information</h3>
        <div class="info-row">
          <span class="info-label">Sales Order</span>
          <span class="info-value">${escapeHtml(data.salesOrderNumber)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pick Ticket</span>
          <span class="info-value">${escapeHtml(data.pickTicketNumber)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Customer</span>
          <span class="info-value">${escapeHtml(data.customerName)}</span>
        </div>
        ${data.customerPoNumber ? `
        <div class="info-row">
          <span class="info-label">Customer PO</span>
          <span class="info-value">${escapeHtml(data.customerPoNumber)}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Ship To</span>
          <span class="info-value">${escapeHtml(data.shipToAddress)}</span>
        </div>
      </div>

      <div class="info-card">
        <h3>Packing Information</h3>
        <div class="info-row">
          <span class="info-label">Packages</span>
          <span class="info-value">${data.totalPackages}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total Weight</span>
          <span class="info-value">${formatWeight(data.totalWeight)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Packed At</span>
          <span class="info-value">${formatDate(data.packedAt)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Packed By</span>
          <span class="info-value">${data.packedBy ? escapeHtml(data.packedBy) : '-'}</span>
        </div>
        ${data.shipmentNumber ? `
        <div class="info-row">
          <span class="info-label">Shipment</span>
          <span class="info-value">${escapeHtml(data.shipmentNumber)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Items Section -->
    <div class="items-section">
      <div class="section-header">
        <div class="section-icon">📦</div>
        <span class="section-title">Packed Contents</span>
      </div>

      ${packageSections}
    </div>

    <!-- Summary -->
    <div class="summary-section">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Packages</div>
          <div class="summary-value">${data.totalPackages}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Lines</div>
          <div class="summary-value">${totalLines}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Qty</div>
          <div class="summary-value">${totalQty}</div>
        </div>
      </div>
    </div>

    ${data.notes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="notes-header">
        <span class="notes-icon">⚠️</span>
        <span class="notes-title">Notes</span>
      </div>
      <p class="notes-text">${escapeHtml(data.notes)}</p>
    </div>
    ` : ''}

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Packed By / Date</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Received By / Date</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
      <p class="footer-text"><span class="footer-brand">Gesher Distribution</span> Management System</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
