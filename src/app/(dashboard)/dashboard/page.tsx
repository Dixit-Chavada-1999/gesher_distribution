/**
 * Dashboard Page
 *
 * Modern professional dashboard with KPIs, charts, pipeline, and activity.
 * Uses modular components from the dashboard feature module.
 *
 * Permission-based rendering:
 * - dashboard.view_module: Access to dashboard page
 * - dashboard.view_analytics: Stats Grid (KPIs) and Charts
 * - dashboard.view_activity: Recent Activity list
 * - dashboard.view_financials: AR/AP summary (requires finance role)
 * - dashboard.view_inventory: Inventory overview
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  DashboardHeader,
  DashboardStatsGrid,
  DashboardActivityList,
  DashboardChartsGrid,
  InventoryOverview,
  ARAPSummary,
  // Mock data
  dashboardStats,
  recentActivities,
  revenueChartData,
  unitsBySKUData,
  channelPerformanceData,
  marginChartData,
  inventoryByLocation,
  arAgingData,
  apSummaryData,
} from '@/features/dashboard';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Dashboard | Gesher Distribution',
  description: 'Overview of your distribution operations',
};

// ============================================
// PAGE COMPONENT
// ============================================

export default async function DashboardPage() {
  // Get current user with permissions for server-side checks
  const user = await getCurrentUser();

  // Server-side module permission check
  // If no permission for dashboard, redirect to no-permission page
  if (!user || !hasPermission(user, 'dashboard.view_module')) {
    redirect('/no-permission');
  }

  // Permission checks for sub-sections
  const canViewAnalytics = hasPermission(user, 'dashboard.view_analytics');
  const canViewActivity = hasPermission(user, 'dashboard.view_activity');
  const canViewFinancials = hasPermission(user, 'dashboard.view_financials');
  const canViewInventory = hasPermission(user, 'dashboard.view_inventory');

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <DashboardHeader />

      {/* KPI Stats Grid - requires dashboard.view_analytics */}
      {canViewAnalytics && (
        <DashboardStatsGrid stats={dashboardStats} />
      )}

      {/* Charts Grid - requires dashboard.view_analytics */}
      {canViewAnalytics && (
        <DashboardChartsGrid
          revenueData={revenueChartData}
          unitsData={unitsBySKUData}
          channelData={channelPerformanceData}
          marginData={marginChartData}
        />
      )}

      {/* Financial Section - requires dashboard.view_financials */}
      {canViewFinancials && (
        <ARAPSummary arData={arAgingData} apData={apSummaryData} />
      )}

      {/* Inventory Overview - requires dashboard.view_inventory */}
      {canViewInventory && (
        <InventoryOverview byLocation={inventoryByLocation} />
      )}

      {/* Recent Activity - requires dashboard.view_activity */}
      {canViewActivity && (
        <DashboardActivityList activities={recentActivities} />
      )}
    </div>
  );
}
