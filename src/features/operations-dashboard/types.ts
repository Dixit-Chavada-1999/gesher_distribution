/**
 * Operations Dashboard Types
 *
 * Type definitions for Jenny's operations dashboard.
 * Based on the Master Sheet spreadsheet structure.
 */

// ============================================
// KPI STATS TYPES
// ============================================

export interface OperationsStats {
  availableInventoryQty: number;
  availableLoads: number;
  availableInventoryValue: number;
  committedCustomerQty: number;
  inTransitNext7Days: number;
  openLoads: number;
  outstandingQty: number;
  invoiceAmount: number;
}

// ============================================
// SKU BREAKDOWN TYPES
// ============================================

export interface SKUBreakdown {
  sku: string;
  skuName: string;
  supplierOutstandingQty: number;
  gdc1AvailableInventory: number;
  combinedQty: number;
  shareOfCombined: number; // percentage
}

// ============================================
// CUSTOMER COMMITMENTS TYPES
// ============================================

export interface CustomerCommitment {
  id: string;
  customer: string;
  loads: number;
  outstandingQty: number;
  invoiceAmount: number;
  inTransitNext7Days: number;
}

// ============================================
// SHIPMENT STATUS TYPES
// ============================================

export type ShipmentStatus =
  | 'AVAILABLE'
  | 'SOLD'
  | 'OPEN'
  | 'HOLD'
  | 'IN_TRANSIT'
  | 'INVOICED'
  | 'DELIVERED';

export interface ShipmentStatusMix {
  status: ShipmentStatus;
  loads: number;
  qty: number;
}

// ============================================
// IMMEDIATE ATTENTION TYPES
// ============================================

export interface ImmediateAttentionItem {
  id: string;
  loadNumber: string;
  customer: string;
  po: string;
  qty: number;
  etaPort: string | null;
  customerEtaDue: string | null;
  status: ShipmentStatus;
  actionRequired: string;
  isOverdue: boolean;
  isThisWeek: boolean;
}

// ============================================
// SHIPMENT SCHEDULE TYPES (Supplier)
// ============================================

export interface ShipmentScheduleItem {
  id: string;
  no: number;
  loadNumber: string;
  sku290_85R38Qty: number;
  sku380_85R24Qty: number;
  skuBeadLockQty: number;
  totalQty: number;
  customer: string;
  po: string;
  etaToUsPort: string | null;
  deliveryAddress: string;
  confirmedEta: string | null;
  customerExpectedDelivery: string | null;
  actualDeliveryDate: string | null;
  qtyDelivered: number;
  outstandingQtyForPO: number;
  status: ShipmentStatus;
  actionRequired: string;
}

// ============================================
// GDC1 INVENTORY TYPES
// ============================================

export interface GDC1InventoryItem {
  id: string;
  no: number;
  loadNumber: string;
  sku290_85R38Qty: number;
  sku380_85R24Qty: number;
  skuBeadLockQty: number;
  totalQty: number;
  customer: string | null;
  po: string | null;
  customerShipWindow: string | null;
  deliveryAddress: string;
  etaToUsPort: string | null;
  customerDueDate: string | null;
  actualDelivery: string | null;
  qtyDelivered: number;
  outstandingPoQty: number;
  invoiceNumber: string | null;
  invoiceAmount: number;
  price38: number;
  price24: number;
  payment50PercentDate: string | null;
  remaining50DueDate: string | null;
  status: ShipmentStatus;
  actionRequired: string;
  ankurNotes: string;
}

// ============================================
// RIM INSTALLATION TYPES
// ============================================

export interface RimInstallationItem {
  id: string;
  gdc1No: number;
  loadNumber: string;
  sku290_85R38Qty: number;
  beadLockQty: number;
  totalQty: number;
  status: ShipmentStatus;
  actionRequired: string;
  executiveNote: string;
}

// ============================================
// FULL OPERATIONS DATA
// ============================================

export interface OperationsData {
  stats: OperationsStats;
  skuBreakdown: SKUBreakdown[];
  customerCommitments: CustomerCommitment[];
  shipmentStatusMix: ShipmentStatusMix[];
  immediateAttention: ImmediateAttentionItem[];
  supplierShipmentSchedule: ShipmentScheduleItem[];
  gdc1Inventory: GDC1InventoryItem[];
  rimInstallationRequired: RimInstallationItem[];
  storyInBrief: string;
}
