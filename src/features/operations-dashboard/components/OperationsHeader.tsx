'use client';

/**
 * Operations Header Component
 *
 * Page header for the operations dashboard with refresh and export actions.
 */

import { RefreshCw, Download, Calendar } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

// ============================================
// TYPES
// ============================================

interface OperationsHeaderProps {
  lastUpdated?: Date;
  onRefresh?: () => void;
  onExport?: () => void;
  isRefreshing?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OperationsHeader({
  lastUpdated,
  onRefresh,
  onExport,
  isRefreshing = false,
}: OperationsHeaderProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Operations Dashboard
        </h1>
        <p className="text-muted-foreground">
          Supplier & GDC Inventory & Shipments
        </p>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Last updated: {formatDate(lastUpdated)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
