/**
 * Dashboard Page
 *
 * Modern professional dashboard with stats, charts, and activity.
 * Uses modular components from the dashboard feature module.
 */

import { Metadata } from 'next';
import { getUser } from '@/shared/lib/supabase/server';

import {
  DashboardHeader,
  DashboardStatsGrid,
  DashboardActivityList,
  DashboardQuickActions,
  DashboardSystemStatus,
  dashboardStats,
  recentActivities,
  quickActions,
  systemStatus,
} from '@/features/dashboard';

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
  const user = await getUser();
  const firstName = user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <DashboardHeader userName={firstName} />

      {/* Stats Grid */}
      <DashboardStatsGrid stats={dashboardStats} />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <DashboardActivityList activities={recentActivities} />

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <DashboardQuickActions actions={quickActions} />

          {/* System Status */}
          <DashboardSystemStatus status={systemStatus} />
        </div>
      </div>
    </div>
  );
}
