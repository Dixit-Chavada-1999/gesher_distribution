/**
 * ADDRESS PARSER SERVICE
 * Parses delivery addresses from Excel into separate components
 * Handles various address formats from GDC Excel sheets
 */

export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export class AddressParserService {
  /**
   * Parse delivery address from Excel format
   *
   * Examples:
   * - "28800 Ida Street Valley, NE 68064"
   * - "214 East 2nd Street Lindsay, NE 68644"
   * - "1625 US East Hwy 6, Holdrege, NE 68949"
   * - "79 S Hwy 83, McCook NE 69001"
   * - "1216 Oregon Street, Hiawatha, KS 66434"
   */
  parseAddress(fullAddress: string | null): ParsedAddress {
    // Default empty address
    const defaultAddress: ParsedAddress = {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    };

    if (!fullAddress || fullAddress.trim() === '') {
      return defaultAddress;
    }

    try {
      // Clean up the address
      let cleaned = fullAddress.trim();

      // Common patterns in Excel addresses:
      // Pattern 1: "Street Address City, STATE ZIP"
      // Pattern 2: "Street Address, City, STATE ZIP"
      // Pattern 3: "Street Address City STATE ZIP"

      // Extract ZIP code first (5 or 9 digits)
      const zipMatch = cleaned.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
      const postalCode = zipMatch ? zipMatch[1] : '';

      // Remove ZIP from string
      if (zipMatch) {
        cleaned = cleaned.replace(zipMatch[0], '').trim();
      }

      // Extract state (2 letter code before ZIP)
      // Common states: NE (Nebraska), KS (Kansas), IA (Iowa), etc.
      const stateMatch = cleaned.match(/\b([A-Z]{2})\s*,?\s*$/);
      const state = stateMatch ? stateMatch[1] : '';

      // Remove state from string
      if (stateMatch) {
        cleaned = cleaned.replace(stateMatch[0], '').trim();
      }

      // Remove trailing comma
      cleaned = cleaned.replace(/,\s*$/, '').trim();

      // Now split remaining string into street and city
      // City is usually after the last comma or after street number + name
      let street = '';
      let city = '';

      // Check if there's a comma separating street and city
      if (cleaned.includes(',')) {
        const parts = cleaned.split(',');
        street = parts[0]?.trim() || '';
        city = parts.slice(1).join(',').trim();
      } else {
        // No comma - try to split by common patterns
        // Pattern: "214 East 2nd Street Lindsay"
        // Look for city name (capitalized word at end)
        const words = cleaned.split(/\s+/);

        // Cities are usually 1-2 words at the end
        // Common city names: Valley, Lindsay, McCook, Holdrege, Hiawatha
        if (words.length >= 2) {
          // Last word is likely city
          city = words[words.length - 1] || '';
          street = words.slice(0, -1).join(' ');
        } else {
          street = cleaned;
        }
      }

      return {
        street: street || '',
        city: city || '',
        state: state || '',
        postalCode: postalCode || '',
        country: 'US',
      };
    } catch (error) {
      console.warn(`⚠️  Failed to parse address: "${fullAddress}"`, error);
      return {
        street: fullAddress, // Store full address in street field as fallback
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      };
    }
  }

  /**
   * Validate parsed address
   */
  isValidAddress(address: ParsedAddress): boolean {
    // At minimum, we need a street or city
    return !!(address.street || address.city);
  }

  /**
   * Format address for display
   */
  formatAddress(address: ParsedAddress): string {
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
    ].filter(p => p && p.trim() !== '');

    return parts.join(', ');
  }

  /**
   * Parse multiple common address formats
   */
  parseFlexible(fullAddress: string | null): ParsedAddress {
    if (!fullAddress || fullAddress.trim() === '') {
      return {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      };
    }

    // Try primary parser first
    const parsed = this.parseAddress(fullAddress);

    // If we got at least street and ZIP, it's good enough
    if (parsed.street && parsed.postalCode) {
      return parsed;
    }

    // Fallback: Use regex patterns for common formats
    const patterns = [
      // Pattern: "Street, City, STATE ZIP"
      /^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,

      // Pattern: "Street City, STATE ZIP"
      /^(.+?)\s+(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,

      // Pattern: "Street, City STATE ZIP"
      /^(.+?),\s*(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
    ];

    for (const pattern of patterns) {
      const match = fullAddress.match(pattern);
      if (match && match[1] && match[2] && match[3] && match[4]) {
        return {
          street: match[1].trim(),
          city: match[2].trim(),
          state: match[3].trim(),
          postalCode: match[4].trim(),
          country: 'US',
        };
      }
    }

    // Last resort: return primary parser result
    return parsed;
  }
}
