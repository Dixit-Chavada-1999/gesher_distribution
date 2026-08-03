/**
 * Dashboard Page
 *
 * Modern professional dashboard with stats, charts, and activity.
 * Uses modular components from the dashboard feature module.
 *
 * Permission-based rendering:
 * - dashboard.view_module: Access to dashboard page
 * - dashboard.view_analytics: Stats Grid (KPIs)
 * - dashboard.view_activity: Recent Activity list
 * - dashboard.view_sales: Sales-related stats (future)
 * - dashboard.export: Export functionality (future)
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  DashboardHeader,
  DashboardStatsGrid,
  DashboardActivityList,
  dashboardStats,
  recentActivities,
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

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <DashboardHeader />

      {/* Stats Grid - requires dashboard.view_analytics */}
      {canViewAnalytics && (
        <DashboardStatsGrid stats={dashboardStats} />
      )}

      {/* Recent Activity - requires dashboard.view_activity */}
      {canViewActivity && (
        <DashboardActivityList activities={recentActivities} />
      )}
    </div>
  );
}
