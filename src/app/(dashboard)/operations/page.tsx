'use client';

/**
 * Operations Dashboard Page
 *
 * Jenny's main operations view showing:
 * Tab 1: Executive Summary (KPIs, Story in Brief, Immediate Attention)
 * Tab 2: Shipment Overview
 * Tab 3: Supplier Schedule
 * Tab 4: GDC1 Inventory
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

// Import components directly to avoid barrel export issues
import { OperationsHeader } from '@/features/operations-dashboard/components/OperationsHeader';
import { OperationsStatsGrid } from '@/features/operations-dashboard/components/OperationsStatsGrid';
import { ImmediateAttentionTable } from '@/features/operations-dashboard/components/ImmediateAttentionTable';
import { SKUBreakdown } from '@/features/operations-dashboard/components/SKUBreakdown';
import { CustomerCommitments } from '@/features/operations-dashboard/components/CustomerCommitments';
import { ShipmentStatusMix } from '@/features/operations-dashboard/components/ShipmentStatusMix';
import { RimInstallationRequired } from '@/features/operations-dashboard/components/RimInstallationRequired';
import { StoryInBrief } from '@/features/operations-dashboard/components/StoryInBrief';
import { ShipmentOverviewTable } from '@/features/operations-dashboard/components/ShipmentOverviewTable';
import { SupplierShipmentScheduleTable } from '@/features/operations-dashboard/components/SupplierShipmentScheduleTable';
import { GDC1InventoryTable } from '@/features/operations-dashboard/components/GDC1InventoryTable';
import { operationsData } from '@/features/operations-dashboard/lib/mock-data';

export default function OperationsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated] = useState(new Date());

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  const handleExport = () => {
    // TODO: Implement export to Excel
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <OperationsHeader
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isRefreshing={isRefreshing}
      />

      {/* Tabbed Content */}
      <Tabs defaultValue="executive-summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="executive-summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="shipment-overview">Shipment Overview</TabsTrigger>
          <TabsTrigger value="supplier-schedule">Supplier Schedule</TabsTrigger>
          <TabsTrigger value="gdc1-inventory">GDC1 Inventory</TabsTrigger>
        </TabsList>

        {/* Tab 1: Executive Summary */}
        <TabsContent value="executive-summary" className="space-y-6">
          {/* KPI Stats */}
          <OperationsStatsGrid stats={operationsData.stats} />

          {/* Story in Brief */}
          <StoryInBrief content={operationsData.storyInBrief} />

          {/* Immediate Attention - This is what Jenny checks FIRST */}
          <ImmediateAttentionTable items={operationsData.immediateAttention} />

          {/* Two column layout for breakdown and status */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* SKU Breakdown */}
            <SKUBreakdown data={operationsData.skuBreakdown} />

            {/* Shipment Status Mix */}
            <ShipmentStatusMix data={operationsData.shipmentStatusMix} />
          </div>

          {/* Customer Commitments */}
          <CustomerCommitments data={operationsData.customerCommitments} />

          {/* Rim Installation Required - Action Items */}
          <RimInstallationRequired data={operationsData.rimInstallationRequired} />
        </TabsContent>

        {/* Tab 2: Shipment Overview */}
        <TabsContent value="shipment-overview" className="space-y-6">
          <ShipmentOverviewTable
            inTransitItems={operationsData.immediateAttention}
            customerSummary={operationsData.customerCommitments}
          />
        </TabsContent>

        {/* Tab 3: Supplier Schedule */}
        <TabsContent value="supplier-schedule" className="space-y-6">
          <SupplierShipmentScheduleTable data={operationsData.supplierShipmentSchedule} />
        </TabsContent>

        {/* Tab 4: GDC1 Inventory */}
        <TabsContent value="gdc1-inventory" className="space-y-6">
          <GDC1InventoryTable data={operationsData.gdc1Inventory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
