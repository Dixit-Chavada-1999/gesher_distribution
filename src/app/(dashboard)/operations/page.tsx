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

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Loader2 } from 'lucide-react';

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
import { EditShipmentDialog } from '@/features/operations-dashboard/components/EditShipmentDialog';

// Server actions
import { fetchOperationsData } from '@/features/operations-dashboard/actions';

// Mock data as fallback
import { operationsData as mockData } from '@/features/operations-dashboard/lib/mock-data';

// Export utilities
import { exportByType, type ExportType } from '@/features/operations-dashboard/lib/export';

// Types
import type {
  OperationsData,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  ShipmentStatus,
} from '@/features/operations-dashboard/types';

// Helper type for edit dialog
interface EditableShipment {
  id: string;
  loadNumber: string;
  customer: string;
  status: ShipmentStatus;
  actionRequired: string;
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  totalQty?: number;
}

export default function OperationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [data, setData] = useState<OperationsData>(mockData);
  const [error, setError] = useState<string | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<EditableShipment | null>(null);

  // Set initial date on client side only to avoid hydration mismatch
  useEffect(() => {
    if (!lastUpdated) {
      setLastUpdated(new Date());
    }
  }, [lastUpdated]);

  // Fetch data from database
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchOperationsData();

      if (result.success && result.data) {
        setData(result.data);
        setUseMockData(false);
        setError(null);
      } else {
        // If no data in database, use mock data
        console.warn('No data from database, using mock data:', result.error);
        setData(mockData);
        setUseMockData(true);
        setError(null); // Don't show error, just use mock data
      }
    } catch (err) {
      console.error('Error loading operations data:', err);
      // Fall back to mock data on error
      setData(mockData);
      setUseMockData(true);
      setError(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleExport = (type: ExportType = 'all') => {
    exportByType(type, data);
  };

  // Handle edit from Immediate Attention table
  const handleEditAttentionItem = (item: ImmediateAttentionItem) => {
    setEditingShipment({
      id: item.id,
      loadNumber: item.loadNumber,
      customer: item.customer,
      status: item.status,
      actionRequired: item.actionRequired,
      confirmedEta: item.etaPort,
      totalQty: item.qty,
    });
    setEditDialogOpen(true);
  };

  // Handle edit from Supplier Schedule table
  const handleEditScheduleItem = (item: ShipmentScheduleItem) => {
    setEditingShipment({
      id: item.id,
      loadNumber: item.loadNumber,
      customer: item.customer,
      status: item.status,
      actionRequired: item.actionRequired,
      confirmedEta: item.confirmedEta,
      actualDeliveryDate: item.actualDeliveryDate,
      qtyDelivered: item.qtyDelivered,
      totalQty: item.totalQty,
    });
    setEditDialogOpen(true);
  };

  // Handle edit from GDC1 Inventory table
  const handleEditGDC1Item = (item: GDC1InventoryItem) => {
    setEditingShipment({
      id: item.id,
      loadNumber: item.loadNumber,
      customer: item.customer || '',
      status: item.status,
      actionRequired: item.actionRequired,
      confirmedEta: item.etaToUsPort,
      actualDeliveryDate: item.actualDelivery,
      qtyDelivered: item.qtyDelivered,
      totalQty: item.totalQty,
    });
    setEditDialogOpen(true);
  };

  // Handle successful edit - refresh data
  const handleEditSuccess = () => {
    loadData(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading operations data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Mock Data Indicator */}
      {useMockData && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Showing demo data. Add shipments to the database to see real data.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

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
          <OperationsStatsGrid stats={data.stats} />

          {/* Story in Brief */}
          <StoryInBrief content={data.storyInBrief} />

          {/* Immediate Attention - This is what Jenny checks FIRST */}
          <ImmediateAttentionTable
            items={data.immediateAttention}
            onEdit={handleEditAttentionItem}
          />

          {/* Two column layout for breakdown and status */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* SKU Breakdown */}
            <SKUBreakdown data={data.skuBreakdown} />

            {/* Shipment Status Mix */}
            <ShipmentStatusMix data={data.shipmentStatusMix} />
          </div>

          {/* Customer Commitments */}
          <CustomerCommitments data={data.customerCommitments} />

          {/* Rim Installation Required - Action Items */}
          <RimInstallationRequired data={data.rimInstallationRequired} />
        </TabsContent>

        {/* Tab 2: Shipment Overview */}
        <TabsContent value="shipment-overview" className="space-y-6">
          <ShipmentOverviewTable
            inTransitItems={data.immediateAttention}
            customerSummary={data.customerCommitments}
          />
        </TabsContent>

        {/* Tab 3: Supplier Schedule */}
        <TabsContent value="supplier-schedule" className="space-y-6">
          <SupplierShipmentScheduleTable
            data={data.supplierShipmentSchedule}
            onEdit={handleEditScheduleItem}
          />
        </TabsContent>

        {/* Tab 4: GDC1 Inventory */}
        <TabsContent value="gdc1-inventory" className="space-y-6">
          <GDC1InventoryTable
            data={data.gdc1Inventory}
            onEdit={handleEditGDC1Item}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Shipment Dialog */}
      <EditShipmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        shipment={editingShipment}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
