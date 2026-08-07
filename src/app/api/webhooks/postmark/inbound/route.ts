/**
 * Postmark Inbound Email Webhook Handler
 *
 * POST /api/webhooks/postmark/inbound
 *
 * Receives inbound emails from Postmark and processes them.
 * Emails sent to *@inbound.gesher.dev-build.in are caught here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type { PostmarkInboundPayload } from '@/features/inbound-emails/types';

// ============================================
// POST /api/webhooks/postmark/inbound
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming webhook payload
    const payload: PostmarkInboundPayload = await request.json();

    console.log('[Postmark Webhook] Received email:', {
      from: payload.From,
      to: payload.To,
      subject: payload.Subject,
      attachments: payload.Attachments?.length || 0,
    });

    // Validate required fields
    if (!payload.From || !payload.To) {
      console.error('[Postmark Webhook] Missing required fields');
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Extract the local part of the "To" email to identify the user/purpose
    // e.g., "user123@inbound.gesher.dev-build.in" -> "user123"
    const toEmail = payload.To;
    const localPart = toEmail.split('@')[0];

    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Store the inbound email in database
    const { data: inboundEmail, error: insertError } = await supabase
      .from('inbound_emails')
      .insert({
        message_id: payload.MessageID,
        from_email: payload.FromFull?.Email || payload.From,
        from_name: payload.FromFull?.Name || payload.FromName || null,
        to_email: payload.To,
        to_local_part: localPart,
        subject: payload.Subject || '(No Subject)',
        text_body: payload.TextBody || null,
        html_body: payload.HtmlBody || null,
        received_at: payload.Date ? new Date(payload.Date).toISOString() : new Date().toISOString(),
        raw_payload: payload,
        has_attachments: (payload.Attachments?.length || 0) > 0,
        status: 'received',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Postmark Webhook] Failed to insert email:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to store email' },
        { status: 500 }
      );
    }

    console.log('[Postmark Webhook] Email stored:', inboundEmail.id);

    // Process attachments if any
    if (payload.Attachments && payload.Attachments.length > 0) {
      for (const attachment of payload.Attachments) {
        // Only process PDF attachments
        if (attachment.ContentType === 'application/pdf') {
          // Decode base64 content and store in Supabase Storage
          const buffer = Buffer.from(attachment.Content, 'base64');
          const filename = `${Date.now()}_${attachment.Name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const storagePath = `inbound/${inboundEmail.id}/${filename}`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('po-documents')
            .upload(storagePath, buffer, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('[Postmark Webhook] Failed to upload attachment:', uploadError);
            continue;
          }

          // Get signed URL for the file
          const { data: signedUrlData } = await supabase.storage
            .from('po-documents')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

          // Store attachment record
          const { error: attachmentError } = await supabase
            .from('inbound_email_attachments')
            .insert({
              inbound_email_id: inboundEmail.id,
              filename: attachment.Name,
              mime_type: attachment.ContentType,
              size: attachment.ContentLength,
              stored_path: storagePath,
              storage_url: signedUrlData?.signedUrl || null,
              is_pdf: true,
            });

          if (attachmentError) {
            console.error('[Postmark Webhook] Failed to insert attachment:', attachmentError);
          } else {
            console.log('[Postmark Webhook] Attachment stored:', attachment.Name);
          }
        }
      }

      // Update email record to reflect processed attachments
      await supabase
        .from('inbound_emails')
        .update({ status: 'attachments_processed' })
        .eq('id', inboundEmail.id);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Email received and processed',
      emailId: inboundEmail.id,
    });

  } catch (error) {
    console.error('[Postmark Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/webhooks/postmark/inbound
// ============================================

/**
 * Health check endpoint for webhook verification
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Postmark inbound webhook is active',
    timestamp: new Date().toISOString(),
  });
}
