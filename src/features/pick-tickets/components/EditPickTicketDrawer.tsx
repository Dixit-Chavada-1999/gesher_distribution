'use client';

/**
 * EditPickTicketDrawer Component
 *
 * Drawer for editing pick ticket details (priority, notes, special instructions).
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/shared/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Skeleton } from '@/shared/components/ui/skeleton';

import { getPickTicket, updatePickTicket } from '../actions';
import {
  PICK_TICKET_PRIORITIES,
  PICK_TICKET_PRIORITY_LABELS,
  type PickTicketPriority,
  type PickTicketWithItems,
} from '../types';

// ============================================
// TYPES
// ============================================

interface EditPickTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  pickTicketId: string | null;
  onSuccess?: () => void;
}

// Form schema
const editPickTicketSchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  notes: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
});

type EditPickTicketForm = z.infer<typeof editPickTicketSchema>;

// ============================================
// COMPONENT
// ============================================

export function EditPickTicketDrawer({
  open,
  onClose,
  pickTicketId,
  onSuccess,
}: EditPickTicketDrawerProps) {
  const [pickTicket, setPickTicket] = useState<PickTicketWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditPickTicketForm>({
    resolver: zodResolver(editPickTicketSchema),
    defaultValues: {
      priority: 'normal',
      notes: '',
      specialInstructions: '',
    },
  });

  // Fetch pick ticket when drawer opens
  useEffect(() => {
    if (open && pickTicketId) {
      fetchPickTicket();
    }
  }, [open, pickTicketId]);

  const fetchPickTicket = async () => {
    if (!pickTicketId) { return; }

    setIsLoading(true);
    try {
      const result = await getPickTicket(pickTicketId);
      if (result.success && result.data) {
        setPickTicket(result.data);
        // Set form values
        form.reset({
          priority: result.data.priority,
          notes: result.data.notes || '',
          specialInstructions: result.data.specialInstructions || '',
        });
      } else {
        toast.error('Failed to load pick ticket');
        onClose();
      }
    } catch {
      toast.error('Failed to load pick ticket');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: EditPickTicketForm) => {
    if (!pickTicketId) { return; }

    setIsSubmitting(true);
    try {
      const result = await updatePickTicket(pickTicketId, {
        priority: data.priority as PickTicketPriority,
        notes: data.notes || null,
        specialInstructions: data.specialInstructions || null,
      });

      if (result.success) {
        toast.success('Pick ticket updated successfully');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to update pick ticket');
      }
    } catch {
      toast.error('Failed to update pick ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPickTicket(null);
      form.reset();
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isLoading ? 'Loading...' : `Edit ${pickTicket?.pickTicketNumber || 'Pick Ticket'}`}
          </SheetTitle>
          <SheetDescription>
            Update pick ticket details
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : pickTicket ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-6">
              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PICK_TICKET_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {PICK_TICKET_PRIORITY_LABELS[priority]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Special Instructions */}
              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any special handling instructions..."
                        className="min-h-[100px] resize-none"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add internal notes..."
                        className="min-h-[100px] resize-none"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SheetFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </SheetFooter>
            </form>
          </Form>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Pick ticket not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
