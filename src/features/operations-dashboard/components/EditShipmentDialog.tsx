'use client';

/**
 * Edit Shipment Dialog
 *
 * Dialog for Jenny to update shipment status and notes.
 */

import { useState, useEffect, useTransition } from 'react';
import { Loader2, Save, Truck, Package, FileText, Calendar } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';

import { updateShipmentStatus } from '../actions';
import type { ShipmentStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface ShipmentData {
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

interface EditShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ShipmentData | null;
  onSuccess?: () => void;
}

// ============================================
// STATUS OPTIONS
// ============================================

const STATUS_OPTIONS: { value: ShipmentStatus; label: string; color: string }[] = [
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'SOLD', label: 'Sold', color: 'bg-purple-100 text-purple-800' },
  { value: 'HOLD', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-gray-100 text-gray-800' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function EditShipmentDialog({
  open,
  onOpenChange,
  shipment,
  onSuccess,
}: EditShipmentDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Form state
  const [status, setStatus] = useState<ShipmentStatus>(shipment?.status || 'OPEN');
  const [actionRequired, setActionRequired] = useState(shipment?.actionRequired || '');
  const [confirmedEta, setConfirmedEta] = useState(shipment?.confirmedEta || '');
  const [actualDeliveryDate, setActualDeliveryDate] = useState(shipment?.actualDeliveryDate || '');
  const [qtyDelivered, setQtyDelivered] = useState(shipment?.qtyDelivered?.toString() || '0');

  // Reset form when shipment changes
  useEffect(() => {
    if (shipment) {
      setStatus(shipment.status);
      setActionRequired(shipment.actionRequired || '');
      setConfirmedEta(shipment.confirmedEta || '');
      setActualDeliveryDate(shipment.actualDeliveryDate || '');
      setQtyDelivered(shipment.qtyDelivered?.toString() || '0');
    }
  }, [shipment]);

  const handleSave = () => {
    if (!shipment) {
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentStatus({
        shipmentId: shipment.id,
        loadStatus: status,
        actionRequired,
        confirmedEta: confirmedEta || null,
        actualDeliveryDate: actualDeliveryDate || null,
        qtyDelivered: parseInt(qtyDelivered, 10) || 0,
      });

      if (result.success) {
        toast.success('Shipment Updated', {
          description: `${shipment.loadNumber} status updated to ${status}`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update shipment',
        });
      }
    });
  };

  if (!shipment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Edit Shipment
          </DialogTitle>
          <DialogDescription>
            Update status and details for{' '}
            <span className="font-semibold">{shipment.loadNumber}</span>
            {shipment.customer && (
              <>
                {' — '}
                <span className="font-semibold">{shipment.customer}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <Badge variant="outline" className={STATUS_OPTIONS.find(s => s.value === shipment.status)?.color}>
              {shipment.status}
            </Badge>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <Label htmlFor="status">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Load Status
              </span>
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Confirmed ETA */}
          <div className="space-y-2">
            <Label htmlFor="confirmedEta">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Confirmed ETA
              </span>
            </Label>
            <Input
              id="confirmedEta"
              type="date"
              value={confirmedEta}
              onChange={(e) => setConfirmedEta(e.target.value)}
            />
          </div>

          {/* Actual Delivery Date */}
          <div className="space-y-2">
            <Label htmlFor="actualDeliveryDate">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Actual Delivery Date
              </span>
            </Label>
            <Input
              id="actualDeliveryDate"
              type="date"
              value={actualDeliveryDate}
              onChange={(e) => setActualDeliveryDate(e.target.value)}
            />
          </div>

          {/* Qty Delivered */}
          <div className="space-y-2">
            <Label htmlFor="qtyDelivered">
              Qty Delivered
              {shipment.totalQty && (
                <span className="text-muted-foreground ml-1">
                  (of {shipment.totalQty})
                </span>
              )}
            </Label>
            <Input
              id="qtyDelivered"
              type="number"
              min="0"
              value={qtyDelivered}
              onChange={(e) => setQtyDelivered(e.target.value)}
            />
          </div>

          {/* Action Required / Notes */}
          <div className="space-y-2">
            <Label htmlFor="actionRequired">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Action Required / Notes
              </span>
            </Label>
            <Textarea
              id="actionRequired"
              value={actionRequired}
              onChange={(e) => setActionRequired(e.target.value)}
              placeholder="Add notes or action items..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Use | to separate multiple action items
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
