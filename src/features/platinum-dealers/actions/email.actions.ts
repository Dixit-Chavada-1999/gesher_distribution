/**
 * Platinum Dealer Email Actions
 *
 * Server actions for sending dealer allocation emails.
 */

'use server';

import { sendDealerAllocationEmail } from '../services/email.service';

// ============================================
// TYPES
// ============================================

interface SendDealerAllocationEmailActionParams {
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
// SERVER ACTIONS
// ============================================

/**
 * Send allocation notification email to platinum dealer
 * Server action - can only be called from client components
 */
export async function sendDealerAllocationEmailAction(
  params: SendDealerAllocationEmailActionParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('🔄 [sendDealerAllocationEmailAction] Starting email send');

    // Validate required fields
    if (!params.dealerEmail) {
      return {
        success: false,
        error: 'Dealer email is required',
      };
    }

    if (!params.dealerName) {
      return {
        success: false,
        error: 'Dealer name is required',
      };
    }

    if (!params.salesOrderNumber) {
      return {
        success: false,
        error: 'Sales order number is required',
      };
    }

    if (!params.productSku) {
      return {
        success: false,
        error: 'Product SKU is required',
      };
    }

    // Call the email service (server-side only)
    const result = await sendDealerAllocationEmail(params);

    if (!result.success) {
      console.error('❌ [sendDealerAllocationEmailAction] Email send failed:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to send email',
      };
    }

    console.log('✅ [sendDealerAllocationEmailAction] Email sent successfully');

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ [sendDealerAllocationEmailAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
