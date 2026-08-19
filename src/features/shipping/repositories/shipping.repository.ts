/**
 * Shipping Repository
 *
 * Database operations for shipping tracking.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  ShippingEmail,
  ShippingEmailWithInbound,
  ShipmentStatusHistory,
  ShippingEmailExtraction,
  ShipmentReference,
} from '../types';

// ============================================
// SHIPPING EMAILS
// ============================================

/**
 * Create a shipping email record from extraction
 */
export async function createShippingEmail(data: {
  inbound_email_id: string;
  extraction: ShippingEmailExtraction;
}): Promise<ShippingEmail | null> {
  const supabase = createAdminClient();

  const { data: record, error } = await supabase
    .from('shipping_emails')
    .insert({
      inbound_email_id: data.inbound_email_id,
      container_number: data.extraction.containerNumber,
      mbl_number: data.extraction.mblNumber,
      so_number: data.extraction.soNumber,
      vessel_name: data.extraction.vesselName,
      voyage_number: data.extraction.voyageNumber,
      detected_status: data.extraction.detectedStatus,
      status_description: data.extraction.statusDescription,
      current_location: data.extraction.currentLocation,
      eta_port: data.extraction.etaPort,
      eta_ramp: data.extraction.etaRamp,
      lfd_date: data.extraction.lfdDate,
      delivery_date: data.extraction.deliveryDate,
      has_issue: data.extraction.hasIssue,
      issue_type: data.extraction.issueType,
      issue_description: data.extraction.issueDescription,
      is_transload: data.extraction.isTransload,
      new_container_number: data.extraction.newContainerNumber,
      is_processed: false,
      extraction_confidence: data.extraction.confidence,
      raw_extraction: data.extraction as unknown as Record<string, unknown>,
      key_points: data.extraction.keyPoints,
    })
    .select()
    .single();

  if (error) {
    console.error('[Shipping] Error creating shipping email:', error);
    return null;
  }

  return record as ShippingEmail;
}

/**
 * Get shipping emails with pagination
 */
export async function getShippingEmails(params: {
  page?: number;
  limit?: number;
  isProcessed?: boolean;
  hasIssue?: boolean;
}): Promise<{ data: ShippingEmailWithInbound[]; total: number }> {
  const supabase = await createClient();
  const { page = 1, limit = 20, isProcessed, hasIssue } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('shipping_emails')
    .select(
      `
      *,
      inbound_emails (
        id,
        subject,
        from_email,
        from_name,
        received_at
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (isProcessed !== undefined) {
    query = query.eq('is_processed', isProcessed);
  }

  if (hasIssue !== undefined) {
    query = query.eq('has_issue', hasIssue);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[Shipping] Error fetching shipping emails:', error);
    return { data: [], total: 0 };
  }

  return { data: data as ShippingEmailWithInbound[], total: count || 0 };
}

/**
 * Get a single shipping email by ID
 */
export async function getShippingEmailById(
  id: string
): Promise<ShippingEmailWithInbound | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shipping_emails')
    .select(
      `
      *,
      inbound_emails (
        id,
        subject,
        from_email,
        from_name,
        received_at,
        text_body
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Shipping] Error fetching shipping email:', error);
    return null;
  }

  return data as ShippingEmailWithInbound;
}

// ============================================
// SHIPMENT MATCHING
// ============================================

/**
 * Find shipment by container number or SO number
 */
export async function findShipmentByReference(
  containerNumber?: string | null,
  soNumber?: string | null
): Promise<ShipmentReference | null> {
  const supabase = createAdminClient();

  // Try container number first
  if (containerNumber) {
    const { data } = await supabase
      .from('shipments')
      .select('id, shipment_number, sales_order_id')
      .eq('container_number', containerNumber)
      .is('deleted_at', null)
      .single();

    if (data) {
      return {
        id: data.id,
        shipment_number: data.shipment_number,
        sales_order_id: data.sales_order_id,
      };
    }
  }

  // Try SO number - need to join with sales_orders
  if (soNumber) {
    // First find the sales order
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select('id, order_number')
      .eq('order_number', soNumber)
      .is('deleted_at', null)
      .single();

    if (salesOrder) {
      // Then find shipment linked to this sales order
      const { data: shipment } = await supabase
        .from('shipments')
        .select('id, shipment_number, sales_order_id')
        .eq('sales_order_id', salesOrder.id)
        .is('deleted_at', null)
        .single();

      if (shipment) {
        return {
          id: shipment.id,
          shipment_number: shipment.shipment_number,
          sales_order_id: shipment.sales_order_id,
          order_number: salesOrder.order_number,
        };
      }
    }
  }

  return null;
}

// ============================================
// SHIPMENT UPDATE
// ============================================

/**
 * Update shipment with tracking info
 */
export async function updateShipmentTracking(
  shipmentId: string,
  data: {
    container_number?: string;
    mbl_number?: string;
    vessel_name?: string;
    voyage_number?: string;
    tracking_status?: string;
    eta_port_tracking?: string;
    eta_ramp?: string;
    lfd_date?: string;
    has_issue?: boolean;
    issue_type?: string;
    issue_description?: string;
    transload_container?: string;
    is_transloaded?: boolean;
  }
): Promise<boolean> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    ...data,
    last_tracking_update: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const { error } = await supabase
    .from('shipments')
    .update(updateData)
    .eq('id', shipmentId);

  if (error) {
    console.error('[Shipping] Error updating shipment tracking:', error);
    return false;
  }

  return true;
}

// ============================================
// STATUS HISTORY
// ============================================

/**
 * Create status history entry
 */
export async function createStatusHistory(data: {
  shipment_id: string;
  status: string;
  location?: string;
  inbound_email_id?: string;
  shipping_email_id?: string;
  notes?: string;
  raw_extract?: Record<string, unknown>;
}): Promise<ShipmentStatusHistory | null> {
  const supabase = createAdminClient();

  const { data: record, error } = await supabase
    .from('shipment_status_history')
    .insert({
      shipment_id: data.shipment_id,
      status: data.status,
      status_date: new Date().toISOString(),
      location: data.location,
      inbound_email_id: data.inbound_email_id,
      shipping_email_id: data.shipping_email_id,
      notes: data.notes,
      raw_extract: data.raw_extract,
    })
    .select()
    .single();

  if (error) {
    console.error('[Shipping] Error creating status history:', error);
    return null;
  }

  return record as ShipmentStatusHistory;
}

/**
 * Get status history for a shipment
 */
export async function getShipmentStatusHistory(
  shipmentId: string
): Promise<ShipmentStatusHistory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shipment_status_history')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('status_date', { ascending: false });

  if (error) {
    console.error('[Shipping] Error fetching status history:', error);
    return [];
  }

  return data as ShipmentStatusHistory[];
}

// ============================================
// LINKING
// ============================================

/**
 * Link shipping email to shipment
 */
export async function linkShippingEmailToShipment(
  shippingEmailId: string,
  shipmentId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('shipping_emails')
    .update({
      shipment_id: shipmentId,
      is_processed: true,
      is_matched: true,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shippingEmailId);

  if (error) {
    console.error('[Shipping] Error linking email to shipment:', error);
    return false;
  }

  return true;
}

/**
 * Mark shipping email as processed (without match)
 */
export async function markShippingEmailProcessed(
  shippingEmailId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('shipping_emails')
    .update({
      is_processed: true,
      is_matched: false,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shippingEmailId);

  if (error) {
    console.error('[Shipping] Error marking email processed:', error);
    return false;
  }

  return true;
}
