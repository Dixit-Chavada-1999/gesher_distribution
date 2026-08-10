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
  // New chart components
  RevenueChart,
  UnitsBySKUChart,
  ChannelPerformanceChart,
  MarginChart,
  DashboardChartsGrid,
  // New dashboard sections
  NeedsAttention,
  OrderPipeline,
  InventoryOverview,
  ARAgingChart,
  APSummaryCard,
  ARAPSummary,
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
  // New types
  RevenueDataPoint,
  UnitsBySKUDataPoint,
  ChannelPerformanceDataPoint,
  MarginDataPoint,
  ARAgingData,
  APSummaryData,
  NeedsAttentionItem,
  AttentionPriority,
  AttentionCategory,
  PipelineStage,
  InventoryByLocation,
  InventoryBySKU,
} from './types';

// Mock Data
export {
  dashboardStats,
  recentActivities,
  quickActions,
  systemStatus,
  // New mock data
  revenueChartData,
  unitsBySKUData,
  channelPerformanceData,
  marginChartData,
  arAgingData,
  apSummaryData,
  needsAttentionItems,
  orderPipelineData,
  inventoryByLocation,
  inventoryBySKU,
} from './lib/mock-data';

// Utilities
export { getIcon, iconMap } from './lib/icons';
