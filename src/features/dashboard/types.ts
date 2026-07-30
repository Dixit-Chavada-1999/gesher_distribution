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
  | 'bar-chart';

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
