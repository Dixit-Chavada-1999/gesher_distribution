/**
 * Platinum Dealer Email Service
 *
 * Sends allocation notification emails to platinum dealers.
 * Uses SMTP (Nodemailer) for email delivery.
 */

import nodemailer from 'nodemailer';

// ============================================
// TYPES
// ============================================

interface SendDealerAllocationEmailParams {
  // Dealer Info
  dealerEmail: string;
  dealerName: string;
  dealerContactName?: string;

  // Sales Order Info
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;

  // Product Info
  productSku: string;
  productDescription: string;
  quantity: number;

  // Allocation Info
  fulfillmentSource: 'platinum_dealer_inventory' | 'platinum_dealer_fulfillment';
  locationName?: string;
  locationAddress?: string;

  // Additional Info
  notes?: string;
  requestedDeliveryDate?: string;
}

// ============================================
// SMTP TRANSPORTER
// ============================================

/**
 * Create SMTP transporter
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.postmarkapp.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send allocation notification email to platinum dealer
 */
export async function sendDealerAllocationEmail(
  params: SendDealerAllocationEmailParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('📧 [sendDealerAllocationEmail] Sending to:', params.dealerEmail);

    const transporter = createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';
    const from = `"${fromName}" <${fromEmail}>`;

    // Determine subject based on fulfillment source
    const subject =
      params.fulfillmentSource === 'platinum_dealer_inventory'
        ? `New Order Assignment - SO ${params.salesOrderNumber}`
        : `New Fulfillment Request - SO ${params.salesOrderNumber}`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: from,
      to: params.dealerEmail,
      subject: subject,
      html: generateDealerEmailHtml(params),
      text: generateDealerEmailText(params),
    };

    await transporter.sendMail(mailOptions);

    console.log('✅ [sendDealerAllocationEmail] Email sent successfully to:', params.dealerEmail);

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ [sendDealerAllocationEmail] SMTP Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Generate HTML email body for dealer allocation notification
 */
function generateDealerEmailHtml(params: SendDealerAllocationEmailParams): string {
  const {
    dealerName,
    dealerContactName,
    salesOrderNumber,
    customerName,
    productSku,
    productDescription,
    quantity,
    fulfillmentSource,
    locationName,
    locationAddress,
    notes,
    requestedDeliveryDate,
  } = params;

  const isInventorySource = fulfillmentSource === 'platinum_dealer_inventory';
  const sourceLabel = isInventorySource ? 'Dealer Inventory' : 'Dealer Fulfillment';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Assignment</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background-color: ${isInventorySource ? '#dbeafe' : '#fef3c7'};
      color: ${isInventorySource ? '#1e40af' : '#92400e'};
    }
    .section {
      margin-bottom: 25px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-table td {
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-table td:first-child {
      font-weight: 600;
      color: #4b5563;
      width: 40%;
    }
    .info-table td:last-child {
      color: #1f2937;
    }
    .highlight-box {
      background-color: #f3f4f6;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .notes-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 13px;
      color: #6b7280;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>🎯 New Order Assignment</h1>
      <span class="badge">${sourceLabel}</span>
    </div>

    <!-- Greeting -->
    <p>Dear ${dealerContactName || dealerName},</p>
    <p>You have been assigned to fulfill the following sales order:</p>

    <!-- Sales Order Info -->
    <div class="section">
      <div class="section-title">Order Details</div>
      <table class="info-table">
        <tr>
          <td>Sales Order:</td>
          <td><strong>${salesOrderNumber}</strong></td>
        </tr>
        <tr>
          <td>Customer:</td>
          <td>${customerName}</td>
        </tr>
        ${
          requestedDeliveryDate
            ? `
        <tr>
          <td>Delivery Date:</td>
          <td>${requestedDeliveryDate}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    <!-- Product Info -->
    <div class="highlight-box">
      <div class="section-title">Product Information</div>
      <table class="info-table">
        <tr>
          <td>Product SKU:</td>
          <td><strong>${productSku}</strong></td>
        </tr>
        <tr>
          <td>Description:</td>
          <td>${productDescription || '-'}</td>
        </tr>
        <tr>
          <td>Quantity:</td>
          <td><strong style="font-size: 18px; color: #2563eb;">${quantity} units</strong></td>
        </tr>
      </table>
    </div>

    <!-- Location Info (if available) -->
    ${
      locationName || locationAddress
        ? `
    <div class="section">
      <div class="section-title">Location Details</div>
      <table class="info-table">
        ${
          locationName
            ? `
        <tr>
          <td>Location:</td>
          <td>${locationName}</td>
        </tr>
        `
            : ''
        }
        ${
          locationAddress
            ? `
        <tr>
          <td>Address:</td>
          <td>${locationAddress}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>
    `
        : ''
    }

    <!-- Notes (if available) -->
    ${
      notes
        ? `
    <div class="notes-box">
      <div class="section-title">⚠️ Special Instructions</div>
      <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${notes}</p>
    </div>
    `
        : ''
    }

    <!-- Action Required -->
    <div class="section">
      <p><strong>Action Required:</strong></p>
      <ul style="margin: 10px 0; padding-left: 20px; color: #4b5563;">
        ${
          isInventorySource
            ? `
        <li>Verify inventory availability at your location</li>
        <li>Confirm fulfillment timeline</li>
        <li>Prepare items for shipment</li>
        `
            : `
        <li>Review fulfillment requirements</li>
        <li>Confirm procurement and delivery timeline</li>
        <li>Coordinate with customer if needed</li>
        `
        }
      </ul>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>If you have any questions or concerns, please contact our operations team.</p>
      <p style="margin-top: 15px;">
        Best regards,<br>
        <strong>Gesher Distribution Team</strong>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email body for dealer allocation notification
 */
function generateDealerEmailText(params: SendDealerAllocationEmailParams): string {
  const {
    dealerName,
    dealerContactName,
    salesOrderNumber,
    customerName,
    productSku,
    productDescription,
    quantity,
    fulfillmentSource,
    locationName,
    locationAddress,
    notes,
    requestedDeliveryDate,
  } = params;

  const isInventorySource = fulfillmentSource === 'platinum_dealer_inventory';
  const sourceLabel = isInventorySource ? 'DEALER INVENTORY' : 'DEALER FULFILLMENT';

  let text = `
NEW ORDER ASSIGNMENT - ${sourceLabel}
===============================================

Dear ${dealerContactName || dealerName},

You have been assigned to fulfill the following sales order:

ORDER DETAILS
-------------
Sales Order:    ${salesOrderNumber}
Customer:       ${customerName}
${requestedDeliveryDate ? `Delivery Date:  ${requestedDeliveryDate}\n` : ''}

PRODUCT INFORMATION
-------------------
Product SKU:    ${productSku}
Description:    ${productDescription || '-'}
Quantity:       ${quantity} units

`;

  if (locationName || locationAddress) {
    text += `LOCATION DETAILS
-----------------
${locationName ? `Location:  ${locationName}\n` : ''}${locationAddress ? `Address:   ${locationAddress}\n` : ''}

`;
  }

  if (notes) {
    text += `SPECIAL INSTRUCTIONS
--------------------
${notes}

`;
  }

  text += `ACTION REQUIRED
---------------
`;

  if (isInventorySource) {
    text += `- Verify inventory availability at your location
- Confirm fulfillment timeline
- Prepare items for shipment
`;
  } else {
    text += `- Review fulfillment requirements
- Confirm procurement and delivery timeline
- Coordinate with customer if needed
`;
  }

  text += `

If you have any questions or concerns, please contact our operations team.

Best regards,
Gesher Distribution Team
`;

  return text;
}
