'use server';

/**
 * Deals Server Actions
 *
 * Server actions for the Deals module.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/shared/lib/auth/check-permission';
import { dealsService } from '../services/deals.service';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { dealsRepository } from '../repositories/deals.repository';
import type {
  Deal,
  DealNote,
  DealListParams,
  PaginatedDealResult,
  CreateDealDTO,
  UpdateDealDTO,
} from '../types';

// ============================================
// ACTION RESULT TYPE
// ============================================

export type ActionResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get a deal by ID
 */
export async function getDeal(id: string): Promise<ActionResult<Deal>> {
  try {
    const deal = await dealsService.getDeal(id);

    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    return { success: true, data: deal };
  } catch (error) {
    console.error('Error fetching deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal',
    };
  }
}

/**
 * Get paginated list of deals
 */
export async function getDeals(
  params: DealListParams = {}
): Promise<ActionResult<PaginatedDealResult>> {
  try {
    const result = await dealsService.getDeals(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error fetching deals:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deals',
    };
  }
}

/**
 * Get deal statistics
 */
export async function getDealStats(): Promise<
  ActionResult<{
    countByStatus: Record<string, number>;
    valueByStatus: Array<{ status: string; totalValue: number; count: number }>;
    valueByPipeline: Array<{ pipeline: string; totalValue: number; count: number }>;
  }>
> {
  try {
    const stats = await dealsService.getDealStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching deal stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal stats',
    };
  }
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Create a new deal
 */
export async function createDeal(dto: CreateDealDTO): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.createDeal(dto, user?.id);

    revalidatePath('/deals');
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error creating deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create deal',
    };
  }
}

/**
 * Update a deal
 */
export async function updateDeal(
  id: string,
  dto: UpdateDealDTO
): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.updateDeal(id, dto, user?.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error updating deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update deal',
    };
  }
}

/**
 * Delete a deal
 */
export async function deleteDeal(id: string): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    await dealsService.deleteDeal(id, user?.id);

    revalidatePath('/deals');
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete deal',
    };
  }
}

/**
 * Mark deal as won
 */
export async function markDealAsWon(id: string): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.markAsWon(id, user?.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error marking deal as won:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark deal as won',
    };
  }
}

/**
 * Mark deal as lost
 */
export async function markDealAsLost(
  id: string,
  lostReason?: string
): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.markAsLost(id, lostReason, user?.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error marking deal as lost:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark deal as lost',
    };
  }
}

/**
 * Reopen a deal
 */
export async function reopenDeal(id: string): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.reopenDeal(id, user?.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${id}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error reopening deal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reopen deal',
    };
  }
}

/**
 * Link deal to customer
 */
export async function linkDealToCustomer(
  dealId: string,
  customerId: string
): Promise<ActionResult<Deal>> {
  try {
    const user = await getCurrentUser();
    const deal = await dealsService.linkToCustomer(dealId, customerId, user?.id);

    revalidatePath('/deals');
    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: deal };
  } catch (error) {
    console.error('Error linking deal to customer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link deal to customer',
    };
  }
}

// ============================================
// NOTES ACTIONS
// ============================================

/**
 * Get notes for a deal
 */
export async function getDealNotes(dealId: string): Promise<ActionResult<DealNote[]>> {
  try {
    const notes = await dealsService.getNotes(dealId);
    return { success: true, data: notes };
  } catch (error) {
    console.error('Error fetching deal notes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch deal notes',
    };
  }
}

/**
 * Add a note to a deal
 * Saves locally and pushes to Pipedrive if connected
 */
export async function addDealNote(
  dealId: string,
  content: string
): Promise<ActionResult<DealNote>> {
  try {
    const user = await getCurrentUser();

    // 1. Save note locally first
    const note = await dealsService.addNote(
      { dealId, content },
      user?.id
    );

    // 2. Push to Pipedrive if deal is linked (non-blocking)
    try {
      const deal = await dealsRepository.getById(dealId);
      if (deal?.pipedriveDealId) {
        const pushResult = await pipedrivePushService.pushNote(content, {
          dealId: deal.pipedriveDealId,
          personId: deal.pipedrivePersonId || undefined,
          orgId: deal.pipedriveOrgId || undefined,
        });

        if (pushResult.success) {
          console.log(`[addDealNote] Note synced to Pipedrive: ${pushResult.pipedriveNoteId}`);
        } else {
          console.warn(`[addDealNote] Pipedrive push warning: ${pushResult.error}`);
        }
      }
    } catch (pipedriveError) {
      // Log but don't fail - note is saved locally
      console.warn('[addDealNote] Pipedrive push failed (non-blocking):', pipedriveError);
    }

    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: note };
  } catch (error) {
    console.error('Error adding deal note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add deal note',
    };
  }
}

/**
 * Delete a deal note
 */
export async function deleteDealNote(noteId: string, dealId: string): Promise<ActionResult<void>> {
  try {
    await dealsService.deleteNote(noteId);

    revalidatePath(`/deals/${dealId}`);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting deal note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete deal note',
    };
  }
}
