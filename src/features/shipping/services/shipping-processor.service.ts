/**
 * Shipping Processor Service
 *
 * Main processing logic for shipping emails.
 * Orchestrates extraction, matching, and database updates.
 */

import { extractShippingInfo } from './shipping-extract.service';
import * as shippingRepo from '../repositories/shipping.repository';
import type {
  ProcessShippingEmailResult,
  ShippingEmailExtraction,
} from '../types';

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process a shipping email
 *
 * Flow:
 * 1. Extract shipping info using AI
 * 2. Create shipping_emails record
 * 3. Try to match with existing shipment (by Container# or SO#)
 * 4. If matched: Update shipment + Create status history
 * 5. If issue detected: Log for alerting
 */
export async function processShippingEmail(
  inboundEmailId: string,
  subject: string,
  body: string
): Promise<ProcessShippingEmailResult> {
  try {
    // Step 1: Extract shipping info using AI
    console.log(`[Shipping] Processing email: ${subject.substring(0, 50)}...`);

    const extraction = await extractShippingInfo(subject, body);

    console.log(`[Shipping] Extracted:`, {
      container: extraction.containerNumber,
      so: extraction.soNumber,
      status: extraction.detectedStatus,
      hasIssue: extraction.hasIssue,
      confidence: extraction.confidence,
    });

    // Step 2: Create shipping email record
    const shippingEmail = await shippingRepo.createShippingEmail({
      inbound_email_id: inboundEmailId,
      extraction,
    });

    if (!shippingEmail) {
      return {
        success: false,
        error: 'Failed to create shipping email record',
        matched: false,
      };
    }

    // Step 3: Try to match with existing shipment
    const shipment = await shippingRepo.findShipmentByReference(
      extraction.containerNumber,
      extraction.soNumber
    );

    if (shipment) {
      console.log(`[Shipping] Matched to shipment: ${shipment.shipment_number}`);

      // Step 4: Update shipment with tracking info
      await shippingRepo.updateShipmentTracking(shipment.id, {
        container_number: extraction.containerNumber || undefined,
        mbl_number: extraction.mblNumber || undefined,
        vessel_name: extraction.vesselName || undefined,
        voyage_number: extraction.voyageNumber || undefined,
        tracking_status: extraction.detectedStatus,
        eta_port_tracking: extraction.etaPort || undefined,
        eta_ramp: extraction.etaRamp || undefined,
        lfd_date: extraction.lfdDate || undefined,
        has_issue: extraction.hasIssue,
        issue_type: extraction.issueType || undefined,
        issue_description: extraction.issueDescription || undefined,
        transload_container: extraction.newContainerNumber || undefined,
        is_transloaded: extraction.isTransload,
      });

      // Step 5: Create status history entry
      await shippingRepo.createStatusHistory({
        shipment_id: shipment.id,
        status: extraction.detectedStatus,
        location: extraction.currentLocation || undefined,
        inbound_email_id: inboundEmailId,
        shipping_email_id: shippingEmail.id,
        notes: extraction.statusDescription,
        raw_extract: extraction as unknown as Record<string, unknown>,
      });

      // Step 6: Link shipping email to shipment
      await shippingRepo.linkShippingEmailToShipment(
        shippingEmail.id,
        shipment.id
      );

      // Step 7: Handle issues if detected
      if (extraction.hasIssue) {
        await handleShippingIssue(shipment.id, extraction);
      }

      return {
        success: true,
        shippingEmailId: shippingEmail.id,
        shipmentId: shipment.id,
        matched: true,
        extraction,
      };
    }

    // No match found - mark as processed without match
    console.log(
      `[Shipping] No matching shipment found for container: ${extraction.containerNumber}, SO: ${extraction.soNumber}`
    );

    await shippingRepo.markShippingEmailProcessed(shippingEmail.id);

    return {
      success: true,
      shippingEmailId: shippingEmail.id,
      matched: false,
      extraction,
    };
  } catch (error) {
    console.error('[Shipping] Processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      matched: false,
    };
  }
}

// ============================================
// ISSUE HANDLING
// ============================================

/**
 * Handle shipping issues (alerts, notifications)
 *
 * TODO: Implement actual notification system
 * - Email to ops team
 * - Dashboard alert
 * - Slack/Teams notification
 */
async function handleShippingIssue(
  shipmentId: string,
  extraction: ShippingEmailExtraction
): Promise<void> {
  console.log(`[Shipping] Issue detected for shipment ${shipmentId}:`, {
    type: extraction.issueType,
    description: extraction.issueDescription,
  });

  // Log critical issues with appropriate severity
  switch (extraction.issueType) {
    case 'container_damaged':
      console.error(
        `[Shipping] 🚨 CRITICAL - Container Damaged: ${extraction.containerNumber}`
      );
      // TODO: Send urgent notification
      break;

    case 'lfd_approaching':
      console.warn(
        `[Shipping] ⚠️ WARNING - LFD Approaching: ${extraction.lfdDate} for container ${extraction.containerNumber}`
      );
      // TODO: Send warning notification
      break;

    case 'demurrage_risk':
      console.warn(
        `[Shipping] ⚠️ WARNING - Demurrage Risk: ${extraction.containerNumber}`
      );
      // TODO: Send warning notification
      break;

    case 'transload_required':
      console.log(
        `[Shipping] 📦 INFO - Transload Required: ${extraction.containerNumber} → ${extraction.newContainerNumber}`
      );
      break;

    case 'delayed':
      console.warn(
        `[Shipping] ⏰ WARNING - Shipment Delayed: ${extraction.containerNumber}`
      );
      break;

    default:
      console.log(
        `[Shipping] ℹ️ INFO - Issue detected: ${extraction.issueType}`
      );
  }

  // Future: Create notification record in database
  // Future: Send email/Slack notification to ops team
}

// ============================================
// BATCH PROCESSING (for manual/scheduled runs)
// ============================================

/**
 * Reprocess a shipping email
 * Useful for manual review or when AI model is updated
 */
export async function reprocessShippingEmail(
  shippingEmailId: string
): Promise<ProcessShippingEmailResult> {
  // Get the shipping email with inbound email data
  const shippingEmail = await shippingRepo.getShippingEmailById(shippingEmailId);

  if (!shippingEmail) {
    return {
      success: false,
      error: 'Shipping email not found',
      matched: false,
    };
  }

  const inboundEmail = shippingEmail.inbound_emails;
  if (!inboundEmail) {
    return {
      success: false,
      error: 'Inbound email not found',
      matched: false,
    };
  }

  // Re-extract and process
  // Note: This creates a new extraction but doesn't duplicate the shipping_email record
  const extraction = await extractShippingInfo(
    inboundEmail.subject,
    (inboundEmail as { text_body?: string }).text_body || ''
  );

  // Try to match with shipment
  const shipment = await shippingRepo.findShipmentByReference(
    extraction.containerNumber,
    extraction.soNumber
  );

  if (shipment) {
    // Update shipment
    await shippingRepo.updateShipmentTracking(shipment.id, {
      container_number: extraction.containerNumber || undefined,
      mbl_number: extraction.mblNumber || undefined,
      tracking_status: extraction.detectedStatus,
      eta_port_tracking: extraction.etaPort || undefined,
      lfd_date: extraction.lfdDate || undefined,
      has_issue: extraction.hasIssue,
      issue_type: extraction.issueType || undefined,
    });

    // Link email to shipment
    await shippingRepo.linkShippingEmailToShipment(shippingEmailId, shipment.id);

    return {
      success: true,
      shippingEmailId,
      shipmentId: shipment.id,
      matched: true,
      extraction,
    };
  }

  await shippingRepo.markShippingEmailProcessed(shippingEmailId);

  return {
    success: true,
    shippingEmailId,
    matched: false,
    extraction,
  };
}
