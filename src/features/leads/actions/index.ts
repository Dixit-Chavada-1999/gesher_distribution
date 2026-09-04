/**
 * Leads Server Actions
 *
 * Server actions for the Leads module.
 * Handles CRUD operations and Pipedrive sync.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { leadsRepository } from '../repositories/leads.repository';
import type {
  Lead,
  LeadListParams,
  LeadListResult,
  CreateLeadDTO,
  UpdateLeadDTO,
  ConvertLeadDTO,
  LeadNote,
} from '../types';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { pipedriveSyncService } from '@/features/pipedrive/services/pipedrive-sync.service';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of leads
 */
export async function getLeads(
  params: LeadListParams = {}
): Promise<ActionResult<LeadListResult>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const result = await leadsRepository.list(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('[getLeads] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch leads',
    };
  }
}

/**
 * Get a single lead by ID
 */
export async function getLead(id: string): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    console.log('[getLead] Fetching lead with ID:', id);
    const lead = await leadsRepository.getById(id);
    if (!lead) {
      console.log('[getLead] Lead not found');
      return { success: false, error: 'Lead not found' };
    }
    console.log('[getLead] Retrieved lead:', lead.id, 'Name:', lead.name, 'Company:', lead.company, 'UpdatedAt:', lead.updatedAt);
    return { success: true, data: lead };
  } catch (error) {
    console.error('[getLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lead',
    };
  }
}

/**
 * Get lead by Pipedrive person ID
 */
export async function getLeadByPipedriveId(
  pipedrivePersonId: number
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const lead = await leadsRepository.getByPipedrivePersonId(pipedrivePersonId);
    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }
    return { success: true, data: lead };
  } catch (error) {
    console.error('[getLeadByPipedriveId] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch lead',
    };
  }
}

// ============================================
// CRUD ACTIONS
// ============================================

/**
 * Create a new lead
 */
export async function createLead(
  data: CreateLeadDTO
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Create lead locally first
    let lead = await leadsRepository.create(data, appUser.id);

    // Try to push to Pipedrive if connected
    try {
      const isConnected = await pipedrivePushService.isConnected();
      if (isConnected) {
        const pushResult = await pipedrivePushService.pushNewLead({
          title: data.name, // Lead title should be person name
          personName: data.name,
          email: data.email,
          phone: data.phone,
          company: data.company,
          // Address fields
          addressStreet: data.addressStreet,
          addressCity: data.addressCity,
          addressState: data.addressState,
          addressPostalCode: data.addressPostalCode,
          addressCountry: data.addressCountry,
          // Deal info
          value: data.dealValue,
          currency: data.dealCurrency || 'USD',
          expectedCloseDate: data.expectedCloseDate,
          notes: data.notes,
          labelIds: data.pipedriveLabels || undefined,
        });

        if (pushResult.success && pushResult.pipedriveLeadId) {
          // Update local lead with Pipedrive IDs
          lead = await leadsRepository.update(lead.id, {
            pipedriveLeadId: pushResult.pipedriveLeadId,
            pipedrivePersonId: pushResult.pipedrivePersonId,
            pipedriveOrgId: pushResult.pipedriveOrgId,
          }, appUser.id);
        }
      }
    } catch (pipedriveError) {
      // Log but don't fail - lead is already created locally
      console.warn('[createLead] Pipedrive sync warning:', pipedriveError);
    }

    revalidatePath('/leads');
    return { success: true, data: lead };
  } catch (error) {
    console.error('[createLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create lead',
    };
  }
}

/**
 * Update an existing lead
 * Optionally syncs changes to Pipedrive if the lead is linked
 */
export async function updateLead(
  id: string,
  data: UpdateLeadDTO,
  labelIds?: string[]
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Get current lead to check if it's linked to Pipedrive
    const currentLead = await leadsRepository.getById(id);
    if (!currentLead) {
      return { success: false, error: 'Lead not found' };
    }

    console.log('[updateLead] Updating lead:', id);
    console.log('[updateLead] Data received:', JSON.stringify(data, null, 2));
    console.log('[updateLead] Label IDs received:', labelIds);

    // If labelIds are provided, convert them to label names for local storage
    let labelNames: string[] | undefined;
    if (labelIds && labelIds.length > 0) {
      try {
        const availableLabels = await pipedriveSyncService.getLeadLabels();
        labelNames = labelIds
          .map((id) => availableLabels.find((l) => l.id === id)?.name)
          .filter((name): name is string => !!name);
        console.log('[updateLead] Mapped label IDs to names:', labelNames);
      } catch (labelError) {
        console.warn('[updateLead] Could not fetch labels:', labelError);
      }
    } else if (labelIds && labelIds.length === 0) {
      // User explicitly cleared all labels
      labelNames = [];
    }

    // Prepare update data including labels if provided
    const updateData: UpdateLeadDTO = {
      ...data,
      ...(labelNames !== undefined && { pipedriveLabels: labelNames }),
    };

    // Update lead locally
    console.log('[updateLead] Calling repository.update with data:', JSON.stringify({
      name: updateData.name,
      company: updateData.company,
      email: updateData.email,
      pipedriveLabels: updateData.pipedriveLabels,
    }, null, 2));

    const lead = await leadsRepository.update(id, updateData, appUser.id);
    console.log('[updateLead] Repository returned lead:', JSON.stringify({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      updatedAt: lead.updatedAt,
    }, null, 2));

    // Verify the update by reading back from database
    console.log('[updateLead] Verification: reading lead from database...');
    const verifyLead = await leadsRepository.getById(id);
    console.log('[updateLead] Verification result:', JSON.stringify({
      name: verifyLead?.name,
      company: verifyLead?.company,
      updatedAt: verifyLead?.updatedAt,
    }, null, 2));

    if (verifyLead && data.name && verifyLead.name !== data.name) {
      console.error('[updateLead] !!!!! VERIFICATION FAILED !!!!!');
      console.error('[updateLead] Database has:', verifyLead.name, 'but expected:', data.name);
      console.error('[updateLead] This indicates the UPDATE did not commit!');
    } else {
      console.log('[updateLead] Verification PASSED - data matches');
    }

    // Try to push to Pipedrive if connected and lead has Pipedrive ID
    if (currentLead.pipedriveLeadId) {
      try {
        const isConnected = await pipedrivePushService.isConnected();
        if (isConnected) {
          const pushResult = await pipedrivePushService.updateExistingLead(
            id,
            currentLead.pipedriveLeadId,
            currentLead.pipedrivePersonId,
            currentLead.pipedriveOrgId,
            {
              name: data.name,
              email: data.email,
              phone: data.phone,
              company: data.company,
              addressStreet: data.addressStreet,
              addressCity: data.addressCity,
              addressState: data.addressState,
              addressPostalCode: data.addressPostalCode,
              addressCountry: data.addressCountry,
              dealTitle: data.dealTitle,
              dealValue: data.dealValue,
              currency: 'USD',
              expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
              labelIds: labelIds,
            }
          );

          if (!pushResult.success) {
            console.warn('[updateLead] Pipedrive sync warning:', pushResult.error);
          }
        }
      } catch (pipedriveError) {
        // Log but don't fail - lead is already updated locally
        console.warn('[updateLead] Pipedrive sync warning:', pipedriveError);
      }
    }

    revalidatePath('/leads');
    revalidatePath(`/leads/${id}`);
    return { success: true, data: lead };
  } catch (error) {
    console.error('[updateLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update lead',
    };
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    await leadsRepository.delete(id);
    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error('[deleteLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete lead',
    };
  }
}

// ============================================
// CONVERSION ACTIONS
// ============================================

/**
 * Convert a lead to a customer
 */
export async function convertLeadToCustomer(
  id: string,
  data: ConvertLeadDTO
): Promise<ActionResult<{ leadId: string; customerId: string }>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    // Get the lead
    const lead = await leadsRepository.getById(id);
    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    if (lead.convertedCustomerId) {
      return { success: false, error: 'Lead has already been converted' };
    }

    // Create customer from lead
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        name: data.customerData?.name || lead.company || lead.name,
        email: lead.email,
        phone: lead.phone,
        status: 'active',
        channel: data.customerData?.channel || 'dealer',
        billing_street: lead.addressStreet,
        billing_city: lead.addressCity,
        billing_state: lead.addressState,
        billing_postal_code: lead.addressPostalCode,
        billing_country: lead.addressCountry,
        pipedrive_person_id: lead.pipedrivePersonId,
        pipedrive_org_id: lead.pipedriveOrgId,
        pipedrive_deal_id: lead.pipedriveDealId,
        created_by: appUser.id,
        updated_by: appUser.id,
      })
      .select('id')
      .single();

    if (customerError) {
      throw new Error(`Failed to create customer: ${customerError.message}`);
    }

    // Mark lead as converted
    await leadsRepository.markAsConverted(id, customer.id, appUser.id);

    revalidatePath('/leads');
    revalidatePath('/customers');

    return {
      success: true,
      data: { leadId: id, customerId: customer.id },
    };
  } catch (error) {
    console.error('[convertLeadToCustomer] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to convert lead',
    };
  }
}

// ============================================
// NOTES ACTIONS
// ============================================

/**
 * Get notes for a lead
 */
export async function getLeadNotes(
  leadId: string
): Promise<ActionResult<LeadNote[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const notes = await leadsRepository.getNotes(leadId);
    return { success: true, data: notes };
  } catch (error) {
    console.error('[getLeadNotes] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch notes',
    };
  }
}

/**
 * Add a note to a lead
 */
export async function addLeadNote(
  leadId: string,
  content: string
): Promise<ActionResult<LeadNote>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User not found' };
    }

    const note = await leadsRepository.addNote(leadId, content, appUser.id);
    revalidatePath(`/leads/${leadId}`);
    return { success: true, data: note };
  } catch (error) {
    console.error('[addLeadNote] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note',
    };
  }
}

// ============================================
// STATS ACTIONS
// ============================================

/**
 * Get lead statistics
 */
export async function getLeadStats(): Promise<ActionResult<{
  total: number;
  newThisMonth: number;
  qualified: number;
  converted: number;
  totalDealValue: number;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    // Get all leads
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, status, deal_value, created_at');

    if (error) {
      throw new Error(error.message);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = {
      total: leads?.length || 0,
      newThisMonth: leads?.filter(
        (l) => new Date(l.created_at) >= startOfMonth
      ).length || 0,
      qualified: leads?.filter(
        (l) => l.status === 'qualified' || l.status === 'proposal'
      ).length || 0,
      converted: leads?.filter((l) => l.status === 'converted').length || 0,
      totalDealValue: leads?.reduce(
        (sum, l) => sum + (Number(l.deal_value) || 0),
        0
      ) || 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('[getLeadStats] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    };
  }
}
