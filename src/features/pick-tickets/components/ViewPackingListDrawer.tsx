'use client';

/**
 * ViewPackingListDrawer Component
 *
 * Read-only drawer to view packing list details.
 */

import { Loader2, Package, FileText, Scale, Truck, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { PdfViewerModal } from '@/shared/components/pdf-viewer';
import { usePackingList } from '../hooks';
import { markPackingListAsPacked, transitionPackingListStatus } from '../actions/packing-list.actions';
import { PACKING_LIST_STATUS_LABELS, PACKING_LIST_STATUS_COLORS } from '../types';

interface ViewPackingListDrawerProps {
  packingListId: string | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  if (!value || value === '-') {
    return null;
  }
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function ViewPackingListDrawer({
  packingListId,
  open,
  onClose,
  onStatusChange,
}: ViewPackingListDrawerProps) {
  const { data: packingList, isLoading, error, refetch } = usePackingList(open ? packingListId : null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const handleMarkAsPacked = async () => {
    if (!packingList) {
      return;
    }

    setIsUpdating(true);
    try {
      const result = await markPackingListAsPacked(packingList.id);
      if (result.success) {
        toast.success('Packing list marked as packed');
        refetch();
        onStatusChange?.();
      } else {
        toast.error(result.error || 'Failed to mark as packed');
      }
    } catch {
      toast.error('Failed to mark as packed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShip = async () => {
    if (!packingList) {
      return;
    }

    setIsUpdating(true);
    try {
      const result = await transitionPackingListStatus(packingList.id, 'shipped');
      if (result.success) {
        toast.success('Shipment created successfully! Check GDC1 Inventory.');
        refetch();
        onStatusChange?.();
      } else {
        toast.error(result.error || 'Failed to ship');
      }
    } catch {
      toast.error('Failed to ship');
    } finally {
      setIsUpdating(false);
    }
  };

  const canMarkAsPacked = packingList?.status === 'draft';
  const canShip = packingList?.status === 'packed';

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[600px] md:max-w-[700px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : packingList?.packingListNumber || 'Packing List Details'}
          </SheetTitle>
          <SheetDescription>
            {packingList?.pickTicket?.pickTicketNumber
              ? `Pick Ticket: ${packingList.pickTicket.pickTicketNumber}`
              : 'View packing list information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={refetch} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : packingList ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={PACKING_LIST_STATUS_COLORS[packingList.status]}>
                    {PACKING_LIST_STATUS_LABELS[packingList.status]}
                  </Badge>
                </div>

                {/* Packing List Info */}
                <Section title="Packing List Information">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Packing List #"
                      value={
                        <span className="font-mono">{packingList.packingListNumber}</span>
                      }
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Pick Ticket #"
                      value={
                        <span className="font-mono">
                          {packingList.pickTicket?.pickTicketNumber}
                        </span>
                      }
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Sales Order #"
                      value={
                        <span className="font-mono">
                          {packingList.salesOrder?.orderNumber}
                        </span>
                      }
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Customer"
                      value={packingList.salesOrder?.customerName}
                    />
                  </div>
                </Section>

                {/* Package Info */}
                <Section title="Package Information">
                  <div className="grid grid-cols-3 gap-4">
                    <InfoItem
                      label="Total Packages"
                      value={packingList.totalPackages}
                      icon={<Package className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Total Weight"
                      value={
                        packingList.totalWeight
                          ? `${packingList.totalWeight} ${packingList.weightUnit}`
                          : '-'
                      }
                      icon={<Scale className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Shipment"
                      value={packingList.shipment?.shipmentNumber || '-'}
                      icon={<Truck className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Items */}
                <Section title="Packed Items">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="text-right font-semibold">Qty</TableHead>
                          <TableHead className="text-right font-semibold">Package #</TableHead>
                          <TableHead className="text-right font-semibold">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {packingList.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{item.sku}</p>
                                <p className="text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.quantityPacked}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.packageNumber}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.weight ? `${item.weight} lbs` : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Section>

                {/* Notes */}
                {packingList.notes && (
                  <Section title="Notes">
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                      {packingList.notes}
                    </p>
                  </Section>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {packingList && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPdfModal(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View PDF
              </Button>
              {canMarkAsPacked && (
                <Button onClick={handleMarkAsPacked} disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Packed
                </Button>
              )}
              {canShip && (
                <Button onClick={handleShip} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700">
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Truck className="mr-2 h-4 w-4" />
                  Ship & Create Shipment
                </Button>
              )}
            </div>
          </div>
        )}

        {/* PDF Viewer Modal */}
        {packingList && (
          <PdfViewerModal
            open={showPdfModal}
            onClose={() => setShowPdfModal(false)}
            pdfUrl={`/api/packing-lists/${packingList.id}/pdf`}
            title={`Packing List - ${packingList.packingListNumber}`}
            fileName={`PackingList-${packingList.packingListNumber}.pdf`}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
