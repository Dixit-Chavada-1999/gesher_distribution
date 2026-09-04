'use client';

/**
 * ConvertToCustomerDialog Component
 *
 * Dialog for converting a lead to a customer.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { convertLeadToCustomer } from '../actions';
import type { Lead, LeadListItem } from '../types';

// ============================================
// TYPES
// ============================================

interface ConvertToCustomerDialogProps {
  lead: Lead | LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function ConvertToCustomerDialog({
  lead,
  open,
  onClose,
  onSuccess,
}: ConvertToCustomerDialogProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [customerName, setCustomerName] = useState('');
  const [channel, setChannel] = useState<'oem' | 'dealer'>('dealer');
  const [isConverting, setIsConverting] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setCustomerName('');
      setChannel('dealer');
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleConvert = async () => {
    if (!lead) return;

    setIsConverting(true);
    try {
      const result = await convertLeadToCustomer(lead.id, {
        createCustomer: true,
        customerData: {
          name: customerName.trim() || lead.company || lead.name,
          channel,
        },
      });

      if (result.success && result.data) {
        toast.success('Lead converted to customer successfully');
        onSuccess?.(result.data.customerId);
        handleOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to convert lead');
      }
    } catch (error) {
      console.error('Convert lead error:', error);
      toast.error('Failed to convert lead');
    } finally {
      setIsConverting(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  if (!lead) return null;

  const defaultName = lead.company || lead.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convert Lead to Customer
          </DialogTitle>
          <DialogDescription>
            Create a new customer from this lead. The lead will be marked as
            converted and linked to the new customer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium">{lead.name}</h4>
            {lead.company && (
              <p className="text-sm text-muted-foreground">{lead.company}</p>
            )}
            {lead.email && (
              <p className="text-sm text-muted-foreground">{lead.email}</p>
            )}
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={defaultName}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use &quot;{defaultName}&quot;
            </p>
          </div>

          {/* Channel */}
          <div className="space-y-2">
            <Label htmlFor="channel">Customer Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as 'oem' | 'dealer')}>
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="oem">OEM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isConverting}>
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Convert to Customer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
