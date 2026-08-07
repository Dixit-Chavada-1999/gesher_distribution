/**
 * Inbound Emails Server Actions
 *
 * Server actions for fetching and managing inbound emails.
 */

'use server';

import { createClient } from '@/shared/lib/supabase/server';
import type {
  InboundEmail,
  InboundEmailWithAttachments,
  InboundEmailAttachment,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InboundEmailListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// ============================================
// LIST INBOUND EMAILS
// ============================================

export async function getInboundEmails(
  params: InboundEmailListParams = {}
): Promise<ActionResult<{
  data: InboundEmail[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const { page = 1, limit = 20, status, search } = params;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('inbound_emails')
      .select('*', { count: 'exact' })
      .order('received_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_email.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching inbound emails:', error);
      return { success: false, error: 'Failed to fetch emails' };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: {
        data: data as InboundEmail[],
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    };
  } catch (error) {
    console.error('getInboundEmails error:', error);
    return { success: false, error: 'Failed to fetch emails' };
  }
}

// ============================================
// GET SINGLE INBOUND EMAIL
// ============================================

export async function getInboundEmail(
  id: string
): Promise<ActionResult<InboundEmailWithAttachments>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get email
    const { data: email, error: emailError } = await supabase
      .from('inbound_emails')
      .select('*')
      .eq('id', id)
      .single();

    if (emailError || !email) {
      return { success: false, error: 'Email not found' };
    }

    // Get attachments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('inbound_email_attachments')
      .select('*')
      .eq('inbound_email_id', id)
      .order('created_at', { ascending: true });

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
    }

    return {
      success: true,
      data: {
        ...email,
        attachments: (attachments || []) as InboundEmailAttachment[],
      } as InboundEmailWithAttachments,
    };
  } catch (error) {
    console.error('getInboundEmail error:', error);
    return { success: false, error: 'Failed to fetch email' };
  }
}

// ============================================
// UPDATE EMAIL STATUS
// ============================================

export async function updateInboundEmailStatus(
  id: string,
  status: string
): Promise<ActionResult<InboundEmail>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const { data, error } = await supabase
      .from('inbound_emails')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating email status:', error);
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true, data: data as InboundEmail };
  } catch (error) {
    console.error('updateInboundEmailStatus error:', error);
    return { success: false, error: 'Failed to update status' };
  }
}

// ============================================
// DELETE INBOUND EMAIL
// ============================================

export async function deleteInboundEmail(
  id: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const { error } = await supabase
      .from('inbound_emails')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting email:', error);
      return { success: false, error: 'Failed to delete email' };
    }

    return { success: true };
  } catch (error) {
    console.error('deleteInboundEmail error:', error);
    return { success: false, error: 'Failed to delete email' };
  }
}

// ============================================
// GET ATTACHMENT DOWNLOAD URL
// ============================================

export async function getAttachmentUrl(
  attachmentId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get attachment record
    const { data: attachment, error: attachmentError } = await supabase
      .from('inbound_email_attachments')
      .select('stored_path, storage_url')
      .eq('id', attachmentId)
      .single();

    if (attachmentError || !attachment) {
      return { success: false, error: 'Attachment not found' };
    }

    // If we have a stored URL, return it
    if (attachment.storage_url) {
      return { success: true, data: { url: attachment.storage_url } };
    }

    // Otherwise, generate a new signed URL
    if (attachment.stored_path) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('po-documents')
        .createSignedUrl(attachment.stored_path, 60 * 60); // 1 hour

      if (signedUrlError || !signedUrlData) {
        return { success: false, error: 'Failed to generate download URL' };
      }

      return { success: true, data: { url: signedUrlData.signedUrl } };
    }

    return { success: false, error: 'No file path available' };
  } catch (error) {
    console.error('getAttachmentUrl error:', error);
    return { success: false, error: 'Failed to get download URL' };
  }
}
