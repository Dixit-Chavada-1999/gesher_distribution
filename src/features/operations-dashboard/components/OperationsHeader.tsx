'use client';

/**
 * Operations Header Component
 *
 * Page header for the operations dashboard with refresh and export actions.
 */

import { RefreshCw, Download, Calendar, ChevronDown, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

// ============================================
// TYPES
// ============================================

export type ExportOption =
  | 'executive-summary'
  | 'shipment-overview'
  | 'supplier-schedule'
  | 'gdc1-inventory'
  | 'all';

interface OperationsHeaderProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  onExport?: (type: ExportOption) => void;
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => onExport?.('executive-summary')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Executive Summary
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.('shipment-overview')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Shipment Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.('supplier-schedule')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Supplier Schedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.('gdc1-inventory')}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              GDC1 Inventory
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport?.('all')}>
              <Download className="h-4 w-4 mr-2" />
              Export All (Full Report)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
