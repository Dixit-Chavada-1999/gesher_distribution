/**
 * Operations Dashboard Service
 *
 * Business logic for Jenny's operations dashboard.
 * Orchestrates repository calls and applies business rules.
 */

import {
  getOperationsStats,
  getSKUBreakdown,
  getCustomerCommitments,
  getShipmentStatusMix,
  getImmediateAttention,
  getSupplierShipmentSchedule,
  getGDC1Inventory,
  getRimInstallationRequired,
  generateStoryInBrief,
} from '../repositories';
import type { OperationsData } from '../types';

// ============================================
// GET FULL OPERATIONS DATA
// ============================================

/**
 * Fetches all data needed for the operations dashboard
 * This is the main entry point for the dashboard
 */
export async function getOperationsData(): Promise<OperationsData> {
  // Fetch all data in parallel for better performance
  const [
    stats,
    skuBreakdown,
    customerCommitments,
    shipmentStatusMix,
    immediateAttention,
    supplierShipmentSchedule,
    gdc1Inventory,
    rimInstallationRequired,
  ] = await Promise.all([
    getOperationsStats(),
    getSKUBreakdown(),
    getCustomerCommitments(),
    getShipmentStatusMix(),
    getImmediateAttention(),
    getSupplierShipmentSchedule(),
    getGDC1Inventory(),
    getRimInstallationRequired(),
  ]);

  // Generate story in brief based on fetched data
  const storyInBrief = await generateStoryInBrief(stats, skuBreakdown, rimInstallationRequired);

  return {
    stats,
    skuBreakdown,
    customerCommitments,
    shipmentStatusMix,
    immediateAttention,
    supplierShipmentSchedule,
    gdc1Inventory,
    rimInstallationRequired,
    storyInBrief,
  };
}

// ============================================
// INDIVIDUAL DATA FETCHERS (for targeted refresh)
// ============================================

/**
 * Get just the KPI stats
 */
export async function getStats() {
  return getOperationsStats();
}

/**
 * Get SKU breakdown data
 */
export async function getSkuData() {
  return getSKUBreakdown();
}

/**
 * Get customer commitments
 */
export async function getCustomerData() {
  return getCustomerCommitments();
}

/**
 * Get status mix data
 */
export async function getStatusMix() {
  return getShipmentStatusMix();
}

/**
 * Get immediate attention items
 */
export async function getAttentionItems() {
  return getImmediateAttention();
}

/**
 * Get supplier shipment schedule (Galileo)
 */
export async function getSupplierSchedule() {
  return getSupplierShipmentSchedule();
}

/**
 * Get GDC1 warehouse inventory
 */
export async function getWarehouseInventory() {
  return getGDC1Inventory();
}

/**
 * Get items requiring rim installation
 */
export async function getRimItems() {
  return getRimInstallationRequired();
}

// ============================================
// DATA REFRESH
// ============================================

/**
 * Refresh all dashboard data
 * Called when user clicks refresh button
 */
export async function refreshDashboard(): Promise<OperationsData> {
  return getOperationsData();
}

// ============================================
// EXPORT FUNCTIONS (for Excel export)
// ============================================

export interface ExportOptions {
  includeStats?: boolean;
  includeSkuBreakdown?: boolean;
  includeCustomerCommitments?: boolean;
  includeShipmentSchedule?: boolean;
  includeGdc1Inventory?: boolean;
  includeRimInstallation?: boolean;
}

/**
 * Get data formatted for Excel export
 */
export async function getExportData(options: ExportOptions = {}) {
  const {
    includeStats = true,
    includeSkuBreakdown = true,
    includeCustomerCommitments = true,
    includeShipmentSchedule = true,
    includeGdc1Inventory = true,
    includeRimInstallation = true,
  } = options;

  const data: Partial<OperationsData> = {};

  const promises: Promise<void>[] = [];

  if (includeStats) {
    promises.push(getOperationsStats().then((result) => { data.stats = result; }));
  }

  if (includeSkuBreakdown) {
    promises.push(getSKUBreakdown().then((result) => { data.skuBreakdown = result; }));
  }

  if (includeCustomerCommitments) {
    promises.push(getCustomerCommitments().then((result) => { data.customerCommitments = result; }));
  }

  if (includeShipmentSchedule) {
    promises.push(getSupplierShipmentSchedule().then((result) => { data.supplierShipmentSchedule = result; }));
  }

  if (includeGdc1Inventory) {
    promises.push(getGDC1Inventory().then((result) => { data.gdc1Inventory = result; }));
  }

  if (includeRimInstallation) {
    promises.push(getRimInstallationRequired().then((result) => { data.rimInstallationRequired = result; }));
  }

  await Promise.all(promises);

  return data;
}
