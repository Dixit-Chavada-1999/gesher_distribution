/**
 * Dashboard Mock Data
 *
 * Static data for dashboard components.
 * Replace with API calls when backend is ready.
 *
 * Note: Icons are stored as string names (not components)
 * to allow serialization between Server and Client Components.
 */

import type {
  DashboardStat,
  DashboardActivity,
  QuickAction,
  SystemStatus,
} from '../types';

// ============================================
// STATS DATA
// ============================================

export const dashboardStats: DashboardStat[] = [
  {
    id: 'total-orders',
    title: 'Total Orders',
    value: '1,234',
    change: '+12.5%',
    trend: 'up',
    icon: 'package',
    color: 'bg-blue-500',
  },
  {
    id: 'active-customers',
    title: 'Active Customers',
    value: '856',
    change: '+5.2%',
    trend: 'up',
    icon: 'users',
    color: 'bg-emerald-500',
  },
  {
    id: 'inventory-items',
    title: 'Inventory Items',
    value: '2,847',
    change: '-2.1%',
    trend: 'down',
    icon: 'trending-up',
    color: 'bg-orange-500',
  },
  {
    id: 'revenue-mtd',
    title: 'Revenue (MTD)',
    value: '$45,231',
    change: '+18.7%',
    trend: 'up',
    icon: 'dollar-sign',
    color: 'bg-violet-500',
  },
];

// ============================================
// ACTIVITY DATA
// ============================================

export const recentActivities: DashboardActivity[] = [
  {
    id: '1',
    title: 'New order received',
    description: 'Order #12345 from Acme Corp',
    time: '5 min ago',
    status: 'success',
  },
  {
    id: '2',
    title: 'Shipment dispatched',
    description: 'Order #12340 shipped to TechStart Inc',
    time: '1 hour ago',
    status: 'success',
  },
  {
    id: '3',
    title: 'Payment received',
    description: '$2,450 from Global Farms',
    time: '2 hours ago',
    status: 'success',
  },
  {
    id: '4',
    title: 'Low stock alert',
    description: 'Agricultural Tire XL - 5 items left',
    time: '3 hours ago',
    status: 'warning',
  },
  {
    id: '5',
    title: 'New customer registered',
    description: 'Mountain Tires LLC joined',
    time: '4 hours ago',
    status: 'info',
  },
];

// ============================================
// QUICK ACTIONS DATA
// ============================================

export const quickActions: QuickAction[] = [
  {
    id: 'new-order',
    label: 'New Order',
    href: '/sales-orders',
    icon: 'shopping-cart',
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    href: '/customers',
    icon: 'users',
  },
  {
    id: 'new-quote',
    label: 'New Quote',
    href: '/quotes',
    icon: 'file-text',
  },
  {
    id: 'view-shipments',
    label: 'Shipments',
    href: '/shipments',
    icon: 'truck',
  },
];

// ============================================
// SYSTEM STATUS DATA
// ============================================

export const systemStatus: SystemStatus = {
  items: [
    {
      id: 'api',
      name: 'API Status',
      status: 'operational',
    },
    {
      id: 'database',
      name: 'Database',
      status: 'operational',
    },
    {
      id: 'storage',
      name: 'Storage',
      status: 'operational',
    },
  ],
  lastSync: '2 min ago',
};
