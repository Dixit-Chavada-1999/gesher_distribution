/**
 * Dashboard Feature Module
 *
 * Exports all dashboard components, types, and utilities.
 */

// Components
export {
  DashboardHeader,
  DashboardStatsCard,
  DashboardStatsGrid,
  DashboardActivityList,
  DashboardQuickActions,
  DashboardSystemStatus,
} from './components';

// Types
export type {
  DashboardStat,
  DashboardActivity,
  ActivityStatus,
  QuickAction,
  SystemStatus,
  SystemStatusItem,
  SystemHealthStatus,
  DashboardIconName,
} from './types';

// Mock Data
export {
  dashboardStats,
  recentActivities,
  quickActions,
  systemStatus,
} from './lib/mock-data';

// Utilities
export { getIcon, iconMap } from './lib/icons';
