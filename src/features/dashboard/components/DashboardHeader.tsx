'use client';

/**
 * DashboardHeader Component
 *
 * Welcome header with user greeting and primary actions.
 * Gets user name from auth store (hydrated by layout).
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';

// ============================================
// TYPES
// ============================================

interface DashboardHeaderProps {
  title?: string;
  description?: string;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardHeader({
  title = 'Dashboard',
  description,
}: DashboardHeaderProps) {
  const { appUser } = useAuthStore();
  const userName = appUser?.firstName || 'User';
  const greeting = description || `Welcome back, ${userName}! Here's what's happening today.`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-muted-foreground">{greeting}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/customers">Add Customer</Link>
        </Button>
        <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
          <Link href="/sales-orders">
            <Plus className="mr-1 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>
    </div>
  );
}
