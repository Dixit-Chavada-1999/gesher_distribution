/**
 * CUSTOMER MATCHER SERVICE
 * Matches source customer data to existing customers in database
 * Primary match: EIN (Tax ID)
 * Fallback: Normalized name matching
 */

import { SourceCustomerData, CustomerMatchResult, NormalizedCustomerData } from '../types';
import { IngestionRepository } from '../repositories/ingestion.repository';

export class CustomerMatcherService {
  constructor(private repository: IngestionRepository) {}

  /**
   * Match customer by EIN (primary) or name (fallback)
   */
  async matchCustomer(source: SourceCustomerData): Promise<CustomerMatchResult> {
    // Step 1: Try matching by EIN (most reliable)
    const einMatch = await this.repository.findCustomerByEIN(source.ein);
    if (einMatch) {
      return {
        matched: true,
        customerId: einMatch.id,
        ein: source.ein,
        name: einMatch.name,
        action: 'matched_by_ein',
        confidence: 'high',
      };
    }

    // Step 2: Try matching by normalized name
    const normalizedName = this.normalizeName(source.legalName);
    const nameMatch = await this.repository.findCustomerByName(normalizedName);
    if (nameMatch) {
      return {
        matched: true,
        customerId: nameMatch.id,
        ein: source.ein,
        name: nameMatch.name,
        action: 'matched_by_name',
        confidence: 'medium',
      };
    }

    // Step 3: No match - will create new customer
    return {
      matched: false,
      customerId: null,
      ein: source.ein,
      name: source.legalName,
      action: 'create_new',
      confidence: 'high',
    };
  }

  /**
   * Match customer for order (handles special cases)
   */
  async matchCustomerForOrder(customerName: string): Promise<CustomerMatchResult> {
    // Special case: Unallocated inventory (warehouse orders)
    if (this.isUnallocatedOrder(customerName)) {
      // Find or create internal customer "GDC-INTERNAL"
      const internalCustomer = await this.repository.findOrCreateInternalCustomer();
      return {
        matched: true,
        customerId: internalCustomer.id,
        ein: 'INTERNAL',
        name: 'GDC-INTERNAL',
        action: 'matched_by_ein',
        confidence: 'high',
      };
    }

    // Apply name aliases for common short names
    const expandedName = this.applyNameAliases(customerName);

    // Try matching by expanded name first
    const normalizedName = this.normalizeName(expandedName);
    const nameMatch = await this.repository.findCustomerByName(normalizedName);

    if (nameMatch) {
      return {
        matched: true,
        customerId: nameMatch.id,
        ein: nameMatch.tax_id || 'UNKNOWN',
        name: nameMatch.name,
        action: 'matched_by_name',
        confidence: 'medium',
      };
    }

    // No match found
    return {
      matched: false,
      customerId: null,
      ein: 'UNKNOWN',
      name: customerName,
      action: 'create_new',
      confidence: 'low',
    };
  }

  /**
   * Normalize customer data for database insert
   */
  normalizeCustomer(source: SourceCustomerData): NormalizedCustomerData {
    const customerCode = this.generateCustomerCode(source.legalName);
    const displayName = this.extractDisplayName(source.legalName);

    return {
      ein: source.ein,
      existingCustomerId: null, // Set by caller after matching
      customerCode,
      name: displayName,
      legalName: source.legalName,
      taxExempt: source.taxExempt,
      taxExemptNumber: source.taxExempt ? source.ein : null,
      billingAddress: {
        address1: source.billingAddress1,
        address2: source.billingAddress2,
        city: source.billingCity,
        state: source.billingState,
        postalCode: source.billingPostalCode,
        country: source.billingCountry,
      },
      shippingAddress: source.shippingSameAsBilling
        ? {
            address1: source.billingAddress1,
            address2: source.billingAddress2,
            city: source.billingCity,
            state: source.billingState,
            postalCode: source.billingPostalCode,
            country: source.billingCountry,
          }
        : {
            address1: source.shippingAddress1,
            address2: source.shippingAddress2,
            city: source.shippingCity,
            state: source.shippingState,
            postalCode: source.shippingPostalCode,
            country: source.shippingCountry || 'US',
          },
      contacts: this.buildContacts(source),
      channel: 'oem', // All GDC customers are OEM
      status: 'active',
      internalNotes: source.notes,
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Apply name aliases for common short names used in orders
   */
  private applyNameAliases(customerName: string): string {
    const aliases: Record<string, string> = {
      valley: 'Valmont',
      lindsay: 'Lindsey',
      lindzay: 'Lindsey',
      wish: 'WISH Nebraska',
      mwi: 'MWI',
      western: 'Western Irrigation',
    };

    const normalized = customerName.toLowerCase().trim();
    for (const [alias, fullName] of Object.entries(aliases)) {
      if (normalized.includes(alias)) {
        return fullName;
      }
    }

    return customerName;
  }

  /**
   * Check if order is for unallocated inventory
   */
  private isUnallocatedOrder(customerName: string): boolean {
    const normalized = customerName.toLowerCase().trim();
    return (
      normalized.includes('nebraska warehouse') ||
      normalized.includes('kansas warehouse') ||
      normalized === 'gdc'
    );
  }

  /**
   * Normalize name for matching
   * "Valmont Industries, Inc." → "valmont industries"
   * "LINDSEY CORPORATION" → "lindsey corporation"
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.,\-]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/\b(inc|llc|corp|corporation|company|co)\b/gi, '') // Remove legal terms
      .trim();
  }

  /**
   * Generate customer code from legal name
   * "Valmont Industries, Inc." → "VALMONT"
   * "LINDSEY CORPORATION" → "LINDSAY"
   */
  private generateCustomerCode(legalName: string): string {
    // Take first significant word, uppercase, max 20 chars
    const firstWord = (legalName
      .split(/[\s,]+/)[0] || 'CUSTOMER')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    return firstWord.substring(0, 20);
  }

  /**
   * Extract display name from legal name
   * "Valmont Industries, Inc." → "Valmont Industries"
   * "LINDSEY CORPORATION" → "Lindsey Corporation"
   */
  private extractDisplayName(legalName: string): string {
    // Remove legal suffixes
    let name = legalName.replace(/,?\s*(Inc\.?|LLC|Corp\.?|Corporation|Company|Co\.?)$/i, '').trim();

    // Title case if all uppercase
    if (name === name.toUpperCase()) {
      name = name
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return name;
  }

  /**
   * Build contacts array from source data
   */
  private buildContacts(source: SourceCustomerData) {
    const contacts = [];

    // Sales contact
    if (source.salesContactName) {
      contacts.push({
        contactType: 'sales' as const,
        name: source.salesContactName,
        title: null,
        email: source.salesContactEmail,
        phone: source.salesContactPhone,
        isPrimary: true,
      });
    }

    // Billing contact
    if (source.billingContactName) {
      contacts.push({
        contactType: 'billing' as const,
        name: source.billingContactName,
        title: source.billingContactTitle,
        email: source.billingContactEmail,
        phone: source.billingContactPhone,
        isPrimary: contacts.length === 0, // Primary if no sales contact
      });
    }

    return contacts;
  }
}
