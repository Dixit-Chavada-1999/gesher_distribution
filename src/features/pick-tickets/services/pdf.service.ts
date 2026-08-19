/**
 * Pick Ticket PDF Service
 *
 * Generates PDF from pick ticket data using Puppeteer.
 * Uses the Gesher Distribution theme template.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

interface PickTicketPdfData {
  pickTicketNumber: string;
  createdAt: string;
  salesOrderNumber: string;
  customerName: string;
  shipToAddress: string;
  requiredDate: string | null;
  warehouseName: string;
  warehouseCode: string;
  assignedTo: string | null;
  status?: string;
  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    binLocation?: string;
    quantity: number;
    uom: string;
  }>;
  notes?: string | null;
  customerPoNumber?: string | null;
}

/**
 * Generate Pick Ticket PDF
 * Returns base64 encoded PDF
 */
export async function generatePickTicketPdf(data: PickTicketPdfData): Promise<string> {
  const html = generatePickTicketHtml(data);

  let browser = null;

  try {
    // Launch browser - different config for local vs production
    if (isProduction) {
      // Serverless environment (Vercel, AWS Lambda)
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local development - use installed Chrome
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH,
      ].filter(Boolean);

      let executablePath: string | undefined;
      for (const path of possiblePaths) {
        if (path) {
          try {
            const fs = await import('fs');
            if (fs.existsSync(path)) {
              executablePath = path;
              break;
            }
          } catch {
            // Continue to next path
          }
        }
      }

      if (!executablePath) {
        throw new Error('Chrome not found. Please install Chrome or set CHROME_PATH environment variable.');
      }

      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdfBuffer).toString('base64');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate HTML from pick ticket data using Gesher Distribution theme
 */
function generatePickTicketHtml(data: PickTicketPdfData): string {
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) {
      return '-';
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalItems = data.items.length;

  const itemsRows = data.items.map((item) => `
    <tr>
      <td><div class="row-num">${item.rowNum}</div></td>
      <td><span class="sku">${item.sku}</span></td>
      <td class="product-name">${item.productName}</td>
      <td>${item.binLocation ? `<span class="bin-location">${item.binLocation}</span>` : '-'}</td>
      <td class="qty-cell">${item.quantity}</td>
      <td class="uom-cell">${item.uom}</td>
      <td class="checkbox-cell"><span class="checkbox"></span></td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pick Ticket - ${data.pickTicketNumber}</title>
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
      position: relative;
      overflow: hidden;
    }

    /* Green left border removed per design request */

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
      width: 100px;
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

    .bin-location {
      font-family: 'Consolas', monospace;
      font-size: 11px;
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      border: 1px solid #93c5fd;
    }

    .qty-cell {
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      color: var(--primary);
    }

    .uom-cell {
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
        <div class="document-type">Pick Ticket</div>
        <div class="ticket-number">${data.pickTicketNumber}</div>
        <div class="ticket-meta">Created: ${formatDate(data.createdAt)}</div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-grid">
      <div class="info-card">
        <h3>Sales Order Information</h3>
        <div class="info-row">
          <span class="info-label">Order #</span>
          <span class="info-value">${data.salesOrderNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Customer</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        ${data.customerPoNumber ? `
        <div class="info-row">
          <span class="info-label">Customer PO</span>
          <span class="info-value">${data.customerPoNumber}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Ship To</span>
          <span class="info-value">${data.shipToAddress}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Required Date</span>
          <span class="info-value">${formatDate(data.requiredDate)}</span>
        </div>
      </div>

      <div class="info-card">
        <h3>Warehouse Information</h3>
        <div class="info-row">
          <span class="info-label">Warehouse</span>
          <span class="info-value">${data.warehouseName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Location Code</span>
          <span class="info-value">${data.warehouseCode}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Assigned To</span>
          <span class="info-value">${data.assignedTo || '-'}</span>
        </div>
      </div>
    </div>

    <!-- Items Section -->
    <div class="items-section">
      <div class="section-header">
        <div class="section-icon">📦</div>
        <span class="section-title">Items to Pick</span>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 110px;">SKU</th>
            <th>Product Name</th>
            <th style="width: 90px;">Bin / Zone</th>
            <th style="width: 60px;">Qty</th>
            <th style="width: 50px;">UOM</th>
            <th style="width: 70px;">Picked</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div class="summary-section">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Total Items</div>
          <div class="summary-value">${totalItems}</div>
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
        <span class="notes-title">Special Instructions</span>
      </div>
      <p class="notes-text">${data.notes}</p>
    </div>
    ` : ''}

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Picked By / Date</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Verified By / Date</div>
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
