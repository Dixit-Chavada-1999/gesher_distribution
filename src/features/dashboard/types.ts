/**
 * Dashboard Types
 *
 * Type definitions for dashboard components and data.
 * Note: Icons are stored as string names to allow serialization
 * between Server and Client Components.
 */

// ============================================
// ICON TYPES
// ============================================

export type DashboardIconName =
  | 'package'
  | 'users'
  | 'trending-up'
  | 'dollar-sign'
  | 'shopping-cart'
  | 'file-text'
  | 'truck'
  | 'bar-chart'
  | 'percent'
  | 'alert-triangle'
  | 'credit-card'
  | 'warehouse'
  | 'target'
  | 'clock';

// ============================================
// STATS TYPES
// ============================================

export interface DashboardStat {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: DashboardIconName;
  color: string;
  subtitle?: string; // For additional info like "38": 800, 24": 434"
  target?: string; // For target comparison
}

// ============================================
// ACTIVITY TYPES
// ============================================

export type ActivityStatus = 'success' | 'warning' | 'info' | 'error';

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  time: string;
  status: ActivityStatus;
}

// ============================================
// QUICK ACTION TYPES
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon?: DashboardIconName;
}

// ============================================
// SYSTEM STATUS TYPES
// ============================================

export type SystemHealthStatus = 'operational' | 'degraded' | 'down';

export interface SystemStatusItem {
  id: string;
  name: string;
  status: SystemHealthStatus;
  message?: string;
}

export interface SystemStatus {
  items: SystemStatusItem[];
  lastSync: string;
}

// ============================================
// CHART DATA TYPES
// ============================================

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  target: number;
  lastYear?: number;
}

export interface UnitsBySKUDataPoint {
  name: string;
  units38: number;
  units24: number;
}

export interface ChannelPerformanceDataPoint {
  channel: string;
  revenue: number;
  units: number;
  fill: string;
}

export interface MarginDataPoint {
  month: string;
  margin: number;
  target: number;
  sku38Margin?: number;
  sku24Margin?: number;
}

// ============================================
// AR/AP TYPES
// ============================================

export interface ARAgingData {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

export interface APSummaryData {
  totalOutstanding: number;
  dueThisWeek: number;
  dueNextWeek: number;
  supplierName: string;
}

// ============================================
// NEEDS ATTENTION TYPES
// ============================================

export type AttentionPriority = 'high' | 'medium' | 'low';
export type AttentionCategory =
  | 'credit_hold'
  | 'price_approval'
  | 'quote_approval'
  | 'stock_contention'
  | 'low_inventory'
  | 'shipment_today'
  | 'sync_failed'
  | 'past_due_ar';

export interface NeedsAttentionItem {
  id: string;
  category: AttentionCategory;
  title: string;
  description: string;
  count: number;
  priority: AttentionPriority;
  assignee?: string;
  href?: string;
}

// ============================================
// ORDER PIPELINE TYPES
// ============================================

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  status: 'active' | 'completed' | 'pending';
}

// ============================================
// INVENTORY OVERVIEW TYPES
// ============================================

export interface InventoryByLocation {
  location: string;
  onHand: number;
  allocated: number;
  available: number;
  inTransit: number;
  daysOfCover: number;
}

export interface InventoryBySKU {
  sku: string;
  name: string;
  total: number;
  allocated: number;
  available: number;
}
