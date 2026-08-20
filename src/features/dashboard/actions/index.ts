'use server';

/**
 * Dashboard Server Actions
 *
 * API layer for dashboard data.
 */

import { createClient } from '@/shared/lib/supabase/server';
import * as dashboardRepo from '../repositories';
import type { UnitsBySKUChartData, ChannelPerformanceDataPoint, InventoryByLocation, DashboardStat, MarginDataPoint, RevenueDataPoint } from '../types';

// ============================================
// UNITS BY SKU
// ============================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get units sold by ALL products grouped by month
 */
export async function getUnitsBySKUData(): Promise<ActionResult<UnitsBySKUChartData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getUnitsBySKU();

  return {
    success: true,
    data,
  };
}

// ============================================
// CHANNEL PERFORMANCE
// ============================================

/**
 * Get channel performance data (OEM vs Dealer)
 */
export async function getChannelPerformanceData(): Promise<ActionResult<ChannelPerformanceDataPoint[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getChannelPerformance();

  return {
    success: true,
    data,
  };
}

// ============================================
// INVENTORY BY LOCATION
// ============================================

/**
 * Get inventory overview by location
 */
export async function getInventoryByLocationData(): Promise<ActionResult<InventoryByLocation[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getInventoryByLocation();

  return {
    success: true,
    data,
  };
}

// ============================================
// DASHBOARD STATS (KPIs)
// ============================================

/**
 * Get dashboard KPI stats
 */
export async function getDashboardStatsData(): Promise<ActionResult<DashboardStat[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getDashboardStats();

  return {
    success: true,
    data,
  };
}

// ============================================
// MARGIN ANALYSIS
// ============================================

/**
 * Get margin analysis data for last 6 months
 */
export async function getMarginAnalysisData(): Promise<ActionResult<MarginDataPoint[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getMarginAnalysis();

  return {
    success: true,
    data,
  };
}

// ============================================
// REVENUE TREND
// ============================================

/**
 * Get revenue trend data for last 8 months
 */
export async function getRevenueTrendData(): Promise<ActionResult<RevenueDataPoint[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const data = await dashboardRepo.getRevenueTrend();

  return {
    success: true,
    data,
  };
}
