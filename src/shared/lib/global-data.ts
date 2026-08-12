/**
 * Global Static Data
 *
 * IMPORTANT: DO NOT DELETE THIS FILE
 *
 * This file contains permanent application configuration data
 * that is used throughout the application. Unlike mock-data.ts
 * (which contains sample/dummy data), this file contains real
 * configuration that the application depends on.
 *
 * In the future, this data can be migrated to database tables
 * and managed via admin panel.
 */

// ============================================
// SHIPPING METHODS
// ============================================

export interface ShippingMethod {
  id: string;
  name: string;
  estimatedDays: number;
}

/**
 * Available shipping methods for sales orders.
 *
 * - Freight LTL: Less Than Truckload - partial truck shipments
 * - Freight FTL: Full Truckload - complete truck shipments
 * - Ocean Container: International shipping from overseas (India)
 * - Customer Pickup: Customer arranges own pickup
 */
export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'ship-001', name: 'Freight - LTL (Less Than Truckload)', estimatedDays: 7 },
  { id: 'ship-002', name: 'Freight - FTL (Full Truckload)', estimatedDays: 5 },
  { id: 'ship-003', name: 'Ocean Container', estimatedDays: 45 },
  { id: 'ship-004', name: 'Customer Pickup', estimatedDays: 0 },
];

// ============================================
// CURRENCIES
// ============================================

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

/**
 * Supported currencies for transactions.
 */
export const CURRENCIES: Currency[] = [
  { id: 'cur-001', code: 'USD', name: 'US Dollar', symbol: '$' },
  { id: 'cur-002', code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { id: 'cur-003', code: 'EUR', name: 'Euro', symbol: '\u20AC' },
];

// ============================================
// UNITS OF MEASURE
// ============================================

export interface Unit {
  id: string;
  code: string;
  name: string;
}

/**
 * Units of measure for products and order items.
 */
export const UNITS: Unit[] = [
  { id: 'unit-001', code: 'EA', name: 'Each' },
  { id: 'unit-002', code: 'SET', name: 'Set' },
  { id: 'unit-003', code: 'PR', name: 'Pair' },
  { id: 'unit-004', code: 'BOX', name: 'Box' },
];

// ============================================
// TAX RATES
// ============================================

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

/**
 * Available tax rates for order calculations.
 */
export const TAX_RATES: TaxRate[] = [
  { id: 'tax-001', name: 'Standard Tax', rate: 8.25 },
  { id: 'tax-002', name: 'Reduced Tax', rate: 5.0 },
  { id: 'tax-003', name: 'Tax Exempt', rate: 0 },
];

// ============================================
// DEFAULT VALUES
// ============================================

/**
 * Default currency for new transactions
 */
export const DEFAULT_CURRENCY = CURRENCIES[0]; // USD

/**
 * Default unit of measure
 */
export const DEFAULT_UNIT = UNITS[0]; // Each

/**
 * Default tax rate
 */
export const DEFAULT_TAX_RATE = TAX_RATES[2]; // Tax Exempt
