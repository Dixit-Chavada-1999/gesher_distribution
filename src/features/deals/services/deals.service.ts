/**
 * Deals Service
 *
 * Business logic for the Deals module.
 */

import { dealsRepository } from '../repositories/deals.repository';
import type {
  Deal,
  DealNote,
  DealListParams,
  PaginatedDealResult,
  CreateDealDTO,
  UpdateDealDTO,
  CreateDealNoteDTO,
  DealSyncResult,
} from '../types';

class DealsService {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a deal by ID
   */
  async getDeal(id: string): Promise<Deal | null> {
    return dealsRepository.getById(id);
  }

  /**
   * Get a deal by Pipedrive Deal ID
   */
  async getDealByPipedriveDealId(pipedriveDealId: number): Promise<Deal | null> {
    return dealsRepository.getByPipedriveDealId(pipedriveDealId);
  }

  /**
   * Get paginated list of deals
   */
  async getDeals(params: DealListParams = {}): Promise<PaginatedDealResult> {
    return dealsRepository.list(params);
  }

  /**
   * Get deal statistics
   */
  async getDealStats(): Promise<{
    countByStatus: Record<string, number>;
    valueByStatus: Array<{ status: string; totalValue: number; count: number }>;
    valueByPipeline: Array<{ pipeline: string; totalValue: number; count: number }>;
  }> {
    const [countByStatus, valueByStatus, valueByPipeline] = await Promise.all([
      dealsRepository.getCountByStatus(),
      dealsRepository.getTotalValueByStatus(),
      dealsRepository.getTotalValueByPipeline(),
    ]);

    return {
      countByStatus,
      valueByStatus,
      valueByPipeline,
    };
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new deal
   */
  async createDeal(dto: CreateDealDTO, userId?: string): Promise<Deal> {
    return dealsRepository.create(dto, userId);
  }

  /**
   * Update a deal
   */
  async updateDeal(id: string, dto: UpdateDealDTO, userId?: string): Promise<Deal> {
    return dealsRepository.update(id, dto, userId);
  }

  /**
   * Delete a deal
   */
  async deleteDeal(id: string, userId?: string): Promise<void> {
    return dealsRepository.delete(id, userId);
  }

  /**
   * Mark deal as won
   */
  async markAsWon(id: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(
      id,
      {
        status: 'won',
        wonTime: new Date(),
        closeTime: new Date(),
      },
      userId
    );
  }

  /**
   * Mark deal as lost
   */
  async markAsLost(id: string, lostReason?: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(
      id,
      {
        status: 'lost',
        lostTime: new Date(),
        closeTime: new Date(),
        lostReason: lostReason || null,
      },
      userId
    );
  }

  /**
   * Reopen a deal
   */
  async reopenDeal(id: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(
      id,
      {
        status: 'open',
        wonTime: null,
        lostTime: null,
        closeTime: null,
        lostReason: null,
      },
      userId
    );
  }

  /**
   * Link deal to customer
   */
  async linkToCustomer(dealId: string, customerId: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(dealId, { customerId }, userId);
  }

  /**
   * Link deal to lead
   */
  async linkToLead(dealId: string, leadId: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(dealId, { leadId }, userId);
  }

  // ============================================
  // NOTES OPERATIONS
  // ============================================

  /**
   * Get notes for a deal
   */
  async getNotes(dealId: string): Promise<DealNote[]> {
    return dealsRepository.getNotes(dealId);
  }

  /**
   * Add a note to a deal
   */
  async addNote(dto: CreateDealNoteDTO, userId?: string): Promise<DealNote> {
    return dealsRepository.createNote(dto, userId);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    return dealsRepository.deleteNote(noteId);
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Upsert deal from Pipedrive
   */
  async upsertFromPipedrive(dto: CreateDealDTO, userId?: string): Promise<{ deal: Deal; isNew: boolean }> {
    return dealsRepository.upsertFromPipedrive(dto, userId);
  }

  /**
   * Sync deals from Pipedrive
   * This is called by the pipedrive-sync service
   */
  async syncFromPipedrive(
    deals: CreateDealDTO[],
    userId?: string
  ): Promise<DealSyncResult> {
    const result: DealSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };

    // Get existing Pipedrive deal IDs
    const existingDealIds = await dealsRepository.getAllPipedriveDealIds();
    const incomingDealIds = deals
      .map((d) => d.pipedriveDealId)
      .filter((id): id is number => id !== null);

    // Process each deal
    for (const dealDto of deals) {
      try {
        if (!dealDto.pipedriveDealId) {
          result.skipped++;
          continue;
        }

        const { isNew } = await dealsRepository.upsertFromPipedrive(dealDto, userId);

        if (isNew) {
          result.created++;
        } else {
          result.updated++;
        }
      } catch (error) {
        result.errors.push({
          pipedriveDealId: dealDto.pipedriveDealId || 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Soft delete deals that are no longer in Pipedrive
    const deletedDealIds = existingDealIds.filter((id) => !incomingDealIds.includes(id));
    if (deletedDealIds.length > 0) {
      result.deleted = await dealsRepository.softDeleteByPipedriveDealIds(deletedDealIds, userId);
    }

    return result;
  }
}

// Export singleton instance
export const dealsService = new DealsService();
