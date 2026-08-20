/**
 * Dashboard Page
 *
 * Role-based dashboard rendering:
 * - Operations Manager: Shows Jenny's Operations Dashboard
 * - Other roles: Shows executive dashboard with KPIs, charts, and activity
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
  // Mock data (to be replaced with dynamic data)
  dashboardStats,
  recentActivities,
  revenueChartData,
  unitsBySKUData,
  channelPerformanceData,
  marginChartData,
  inventoryByLocation,
  arAgingData,
  apSummaryData,
  // Actions
  getUnitsBySKUData,
  getChannelPerformanceData,
  getInventoryByLocationData,
  getDashboardStatsData,
  getMarginAnalysisData,
} from '@/features/dashboard';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';

// Operations Dashboard imports
import { OperationsDashboardContent } from './OperationsDashboardContent';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Dashboard | Gesher Distribution',
  description: 'Overview of your distribution operations',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has Operations Manager role
 */
function isOperationsManager(roleName: string | undefined): boolean {
  if (!roleName) {
    return false;
  }
  const normalized = roleName.toLowerCase().replace(/[_\s]/g, '');
  return normalized === 'operationsmanager' || normalized === 'operations';
}

/**
 * Check if user is a supplier portal user
 */
function isSupplierUser(supplierId: string | null | undefined): boolean {
  return supplierId !== null && supplierId !== undefined;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function DashboardPage() {
  // Get current user with permissions for server-side checks
  const user = await getCurrentUser();

  // Must be logged in
  if (!user) {
    redirect('/login');
  }

  // Check if user is a supplier FIRST - redirect to supplier portal
  // This must happen before permission checks since suppliers don't have dashboard permissions
  if (isSupplierUser(user.supplierId)) {
    redirect('/supplier-portal');
  }

  // Server-side module permission check (for non-supplier users)
  // If no permission for dashboard, redirect to no-permission page
  if (!hasPermission(user, 'dashboard.view_module')) {
    redirect('/no-permission');
  }

  // Check if user is Operations Manager - show Operations Dashboard
  if (isOperationsManager(user.role?.name)) {
    return <OperationsDashboardContent />;
  }

  // Permission checks for sub-sections (for executive dashboard)
  const canViewAnalytics = hasPermission(user, 'dashboard.view_analytics');
  const canViewActivity = hasPermission(user, 'dashboard.view_activity');
  const canViewFinancials = hasPermission(user, 'dashboard.view_financials');
  const canViewInventory = hasPermission(user, 'dashboard.view_inventory');

  // Fetch dynamic data for charts and KPIs
  const [unitsBySKUResult, channelResult, inventoryResult, statsResult, marginResult] = await Promise.all([
    getUnitsBySKUData(),
    getChannelPerformanceData(),
    getInventoryByLocationData(),
    getDashboardStatsData(),
    getMarginAnalysisData(),
  ]);

  const dynamicUnitsBySKU = unitsBySKUResult.success && unitsBySKUResult.data?.data?.length
    ? unitsBySKUResult.data.data
    : unitsBySKUData; // Fallback to mock data if no real data
  const unitsProducts = unitsBySKUResult.success && unitsBySKUResult.data?.products?.length
    ? unitsBySKUResult.data.products
    : undefined; // Use default products if no real data

  const dynamicChannelData = channelResult.success && channelResult.data?.length
    ? channelResult.data
    : channelPerformanceData; // Fallback to mock data if no real data

  const dynamicInventory = inventoryResult.success && inventoryResult.data?.length
    ? inventoryResult.data
    : inventoryByLocation; // Fallback to mock data if no real data

  const dynamicStats = statsResult.success && statsResult.data?.length
    ? statsResult.data
    : dashboardStats; // Fallback to mock data if no real data

  const dynamicMarginData = marginResult.success && marginResult.data?.length
    ? marginResult.data
    : marginChartData; // Fallback to mock data if no real data

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <DashboardHeader />

      {/* KPI Stats Grid - requires dashboard.view_analytics */}
      {canViewAnalytics && (
        <DashboardStatsGrid stats={dynamicStats} />
      )}

      {/* Charts Grid - requires dashboard.view_analytics */}
      {canViewAnalytics && (
        <DashboardChartsGrid
          revenueData={revenueChartData}
          unitsData={dynamicUnitsBySKU}
          unitsProducts={unitsProducts}
          channelData={dynamicChannelData}
          marginData={dynamicMarginData}
        />
      )}

      {/* Financial Section - requires dashboard.view_financials */}
      {canViewFinancials && (
        <ARAPSummary arData={arAgingData} apData={apSummaryData} />
      )}

      {/* Inventory Overview - requires dashboard.view_inventory */}
      {canViewInventory && (
        <InventoryOverview byLocation={dynamicInventory} />
      )}

      {/* Recent Activity - requires dashboard.view_activity */}
      {canViewActivity && (
        <DashboardActivityList activities={recentActivities} />
      )}
    </div>
  );
}
