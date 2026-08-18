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
    supplierScheduleResult,
    gdc1InventoryResult,
    rimInstallationResult,
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

  // Extract data and unique SKUs from results
  const supplierShipmentSchedule = supplierScheduleResult.data;
  const supplierScheduleSkus = supplierScheduleResult.uniqueSkus;
  const gdc1Inventory = gdc1InventoryResult.data;
  const gdc1InventorySkus = gdc1InventoryResult.uniqueSkus;
  const rimInstallationRequired = rimInstallationResult.data;
  const rimInstallationSkus = rimInstallationResult.uniqueSkus;

  // Generate story in brief based on fetched data
  const storyInBrief = await generateStoryInBrief(stats, skuBreakdown, rimInstallationRequired);

  return {
    stats,
    skuBreakdown,
    customerCommitments,
    shipmentStatusMix,
    immediateAttention,
    supplierShipmentSchedule,
    supplierScheduleSkus,
    gdc1Inventory,
    gdc1InventorySkus,
    rimInstallationRequired,
    rimInstallationSkus,
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
  const result = await getSupplierShipmentSchedule();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
}

/**
 * Get GDC1 warehouse inventory
 */
export async function getWarehouseInventory() {
  const result = await getGDC1Inventory();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
}

/**
 * Get items requiring rim installation
 */
export async function getRimItems() {
  const result = await getRimInstallationRequired();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
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
    promises.push(getSupplierShipmentSchedule().then((result) => {
      data.supplierShipmentSchedule = result.data;
      data.supplierScheduleSkus = result.uniqueSkus;
    }));
  }

  if (includeGdc1Inventory) {
    promises.push(getGDC1Inventory().then((result) => {
      data.gdc1Inventory = result.data;
      data.gdc1InventorySkus = result.uniqueSkus;
    }));
  }

  if (includeRimInstallation) {
    promises.push(getRimInstallationRequired().then((result) => {
      data.rimInstallationRequired = result.data;
      data.rimInstallationSkus = result.uniqueSkus;
    }));
  }

  await Promise.all(promises);

  return data;
}
