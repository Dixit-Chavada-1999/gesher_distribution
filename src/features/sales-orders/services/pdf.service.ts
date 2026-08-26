/**
 * Sales Order PDF Service
 *
 * Generates PDF from sales order data using Puppeteer.
 * Uses the Gesher Distribution theme template.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export interface SalesOrderPdfData {
  // Order Information
  orderNumber: string;
  orderDate: string;
  requestedDeliveryDate: string | null;
  customerPoNumber: string | null;
  status: string;
  productSource: string | null;

  // Customer Information
  customerName: string;
  customerCode: string;
  customerEmail?: string | null;
  customerPhone?: string | null;

  // Sales Rep
  salesRepName?: string | null;

  // Addresses
  billingAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  shippingAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  shippingMethod?: string | null;

  // Order Items
  items: Array<{
    rowNum: number;
    sku: string;
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number; // in cents
    discountPercent: number;
    lineTotal: number; // in cents
  }>;

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  // Additional
  customerNotes?: string | null;
  internalNotes?: string | null;
}

/**
 * Generate Sales Order PDF
 * Returns base64 encoded PDF
 */
export async function generateSalesOrderPdf(data: SalesOrderPdfData): Promise<string> {
  const html = generateSalesOrderHtml(data);

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
 * Generate HTML from sales order data using Gesher Distribution theme
 */
function generateSalesOrderHtml(data: SalesOrderPdfData): string {
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

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatAddress = (address: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  }): string => {
    const parts = [
      address.street,
      [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
      address.country
    ].filter(Boolean);
    return parts.join('<br>') || '-';
  };

  const formatStatus = (status: string): string => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);

  const itemsRows = data.items.map((item) => `
    <tr>
      <td><div class="row-num">${item.rowNum}</div></td>
      <td><span class="sku">${item.sku}</span></td>
      <td class="product-name">${item.description}</td>
      <td class="qty-cell">${item.quantity}</td>
      <td class="uom-cell">${item.unitCode}</td>
      <td class="price-cell">${formatCurrency(item.unitPrice)}</td>
      <td class="discount-cell">${item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}</td>
      <td class="total-cell">${formatCurrency(item.lineTotal)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sales Order - ${data.orderNumber}</title>
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

    .order-info {
      text-align: right;
    }

    .document-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--muted);
      margin-bottom: 5px;
    }

    .order-number {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 8px;
    }

    .order-meta {
      font-size: 11px;
      color: var(--muted);
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 8px;
    }

    .status-confirmed {
      background: var(--accent);
      color: var(--primary);
    }

    .status-draft {
      background: #fef3c7;
      color: #92400e;
    }

    .status-processing {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-shipped {
      background: #d1fae5;
      color: #065f46;
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

    /* Address Cards */
    .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }

    .address-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
    }

    .address-card h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--primary);
      margin-bottom: 12px;
      font-weight: 600;
    }

    .address-text {
      font-size: 12px;
      line-height: 1.6;
      color: var(--foreground);
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
      width: 28px;
      height: 28px;
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
      color: var(--primary);
    }

    .uom-cell {
      text-align: center;
      color: var(--muted);
      font-size: 11px;
    }

    .price-cell {
      text-align: right;
      font-family: 'Consolas', monospace;
    }

    .discount-cell {
      text-align: center;
      color: var(--danger);
      font-size: 11px;
    }

    .total-cell {
      text-align: right;
      font-weight: 600;
      font-family: 'Consolas', monospace;
    }

    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 25px;
    }

    .totals-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      min-width: 280px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 12px;
    }

    .totals-row.subtotal {
      border-bottom: 1px solid var(--border);
    }

    .totals-row.grand-total {
      border-top: 2px solid var(--primary);
      margin-top: 8px;
      padding-top: 12px;
      font-size: 16px;
      font-weight: 700;
      color: var(--primary);
    }

    .totals-label {
      color: var(--muted);
    }

    .totals-value {
      font-family: 'Consolas', monospace;
      font-weight: 500;
    }

    .totals-row.grand-total .totals-value {
      font-size: 18px;
    }

    /* Notes Section */
    .notes-section {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #86efac;
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 25px;
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
      color: #166534;
      font-weight: 600;
    }

    .notes-text {
      color: #15803d;
      font-size: 12px;
      line-height: 1.6;
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

    .thank-you {
      font-size: 14px;
      color: var(--primary);
      font-weight: 600;
      margin-bottom: 10px;
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
          Phone: (713) 555-8200 | sales@gesherdist.com</p>
        </div>
      </div>
      <div class="order-info">
        <div class="document-type">Sales Order</div>
        <div class="order-number">${data.orderNumber}</div>
        <div class="order-meta">Order Date: ${formatDate(data.orderDate)}</div>
        <div class="status-badge status-${data.status.toLowerCase().replace(/_/g, '-')}">${formatStatus(data.status)}</div>
      </div>
    </div>

    <!-- Info Cards -->
    <div class="info-grid">
      <div class="info-card">
        <h3>Customer Information</h3>
        <div class="info-row">
          <span class="info-label">Customer</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Customer Code</span>
          <span class="info-value">${data.customerCode}</span>
        </div>
        ${data.customerEmail ? `
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${data.customerEmail}</span>
        </div>
        ` : ''}
        ${data.customerPhone ? `
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${data.customerPhone}</span>
        </div>
        ` : ''}
        ${data.customerPoNumber ? `
        <div class="info-row">
          <span class="info-label">Customer PO</span>
          <span class="info-value">${data.customerPoNumber}</span>
        </div>
        ` : ''}
      </div>

      <div class="info-card">
        <h3>Order Details</h3>
        ${data.requestedDeliveryDate ? `
        <div class="info-row">
          <span class="info-label">Delivery Date</span>
          <span class="info-value">${formatDate(data.requestedDeliveryDate)}</span>
        </div>
        ` : ''}
        ${data.shippingMethod ? `
        <div class="info-row">
          <span class="info-label">Shipping</span>
          <span class="info-value">${data.shippingMethod}</span>
        </div>
        ` : ''}
        ${data.productSource ? `
        <div class="info-row">
          <span class="info-label">Source</span>
          <span class="info-value">${data.productSource === 'warehouse' ? 'Warehouse' : 'Dropship'}</span>
        </div>
        ` : ''}
        ${data.salesRepName ? `
        <div class="info-row">
          <span class="info-label">Sales Rep</span>
          <span class="info-value">${data.salesRepName}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- Address Cards -->
    <div class="address-grid">
      <div class="address-card">
        <h3>Bill To</h3>
        <div class="address-text">${formatAddress(data.billingAddress)}</div>
      </div>
      <div class="address-card">
        <h3>Ship To</h3>
        <div class="address-text">${formatAddress(data.shippingAddress)}</div>
      </div>
    </div>

    <!-- Items Section -->
    <div class="items-section">
      <div class="section-header">
        <div class="section-icon">📦</div>
        <span class="section-title">Order Items (${data.items.length} items, ${totalQty} units)</span>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 45px;">#</th>
            <th style="width: 100px;">SKU</th>
            <th>Description</th>
            <th style="width: 50px;">Qty</th>
            <th style="width: 45px;">UOM</th>
            <th style="width: 80px;">Unit Price</th>
            <th style="width: 55px;">Disc</th>
            <th style="width: 90px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-card">
        <div class="totals-row subtotal">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(data.subtotal)}</span>
        </div>
        ${data.discountTotal > 0 ? `
        <div class="totals-row">
          <span class="totals-label">Discount</span>
          <span class="totals-value" style="color: var(--danger);">-${formatCurrency(data.discountTotal)}</span>
        </div>
        ` : ''}
        ${data.taxTotal > 0 ? `
        <div class="totals-row">
          <span class="totals-label">Tax</span>
          <span class="totals-value">${formatCurrency(data.taxTotal)}</span>
        </div>
        ` : ''}
        ${data.shippingCost > 0 ? `
        <div class="totals-row">
          <span class="totals-label">Shipping</span>
          <span class="totals-value">${formatCurrency(data.shippingCost)}</span>
        </div>
        ` : ''}
        <div class="totals-row grand-total">
          <span class="totals-label">Grand Total</span>
          <span class="totals-value">${formatCurrency(data.grandTotal)}</span>
        </div>
      </div>
    </div>

    ${data.customerNotes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="notes-header">
        <span class="notes-icon">📝</span>
        <span class="notes-title">Order Notes</span>
      </div>
      <p class="notes-text">${data.customerNotes}</p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p class="thank-you">Thank you for your business!</p>
      <p class="footer-text">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
      <p class="footer-text"><span class="footer-brand">Gesher Distribution</span> Management System</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
