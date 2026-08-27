'use client';

/**
 * EditPickTicketDrawer Component
 *
 * Drawer for editing pick ticket details (status, priority, assignment, warehouse, notes).
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
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
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Separator } from '@/shared/components/ui/separator';
import { Label } from '@/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { getPickTicket, updatePickTicket } from '../actions';
import { getUsers } from '@/features/users/actions';
import { getLocations } from '@/features/locations/actions';
import {
  PICK_TICKET_STATUSES,
  PICK_TICKET_STATUS_LABELS,
  PICK_TICKET_PRIORITIES,
  PICK_TICKET_PRIORITY_LABELS,
  type PickTicketStatus,
  type PickTicketPriority,
  type PickTicketWithItems,
  type PickTicketItem,
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

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface EditableItem extends PickTicketItem {
  newQuantityToPick: number;
  newQuantityPicked: number;
}

// Form schema
const editPickTicketSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picking', 'picked', 'packing', 'packed', 'shipped', 'cancelled']),
  assignedTo: z.string().nullable().optional(),
  warehouseId: z.string().optional(),
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
  const [users, setUsers] = useState<UserOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  const form = useForm<EditPickTicketForm>({
    resolver: zodResolver(editPickTicketSchema),
    defaultValues: {
      status: 'pending',
      assignedTo: null,
      warehouseId: '',
      priority: 'normal',
      notes: '',
      specialInstructions: '',
    },
  });

  // Fetch pick ticket and options when drawer opens
  useEffect(() => {
    if (open && pickTicketId) {
      fetchPickTicket();
      fetchOptions();
    }
  }, [open, pickTicketId]);

  const fetchOptions = async () => {
    setIsLoadingOptions(true);
    try {
      // Fetch users and warehouses in parallel
      const [usersResult, locationsResult] = await Promise.all([
        getUsers({ status: 'active', limit: 100 }),
        getLocations({ locationType: 'warehouse', limit: 100 }),
      ]);

      if (usersResult.success && usersResult.data) {
        const usersData = usersResult.data as { data: Array<{ id: string; first_name?: string; last_name?: string; email: string }> };
        if (usersData.data) {
          setUsers(
            usersData.data.map((user) => ({
              id: user.id,
              fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
              email: user.email,
            }))
          );
        }
      }

      if (locationsResult.success && locationsResult.data) {
        const locationsData = locationsResult.data as { data: Array<{ id: string; name: string; location_code: string }> };
        if (locationsData.data) {
          setWarehouses(
            locationsData.data.map((loc) => ({
              id: loc.id,
              name: loc.name,
              code: loc.location_code,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const fetchPickTicket = async () => {
    if (!pickTicketId) { return; }

    setIsLoading(true);
    try {
      const result = await getPickTicket(pickTicketId);
      if (result.success && result.data) {
        setPickTicket(result.data);
        // Set form values
        form.reset({
          status: result.data.status,
          assignedTo: result.data.assignedTo || null,
          warehouseId: result.data.warehouseId || '',
          priority: result.data.priority,
          notes: result.data.notes || '',
          specialInstructions: result.data.specialInstructions || '',
        });
        // Initialize editable items
        setEditableItems(
          (result.data.items || []).map((item) => ({
            ...item,
            newQuantityToPick: item.quantityToPick,
            newQuantityPicked: item.quantityPicked,
          }))
        );
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

    // Validate items: quantity_picked must be <= quantity_to_pick
    const invalidItems = editableItems.filter(
      (item) => item.newQuantityPicked > item.newQuantityToPick
    );
    if (invalidItems.length > 0) {
      toast.error(`Picked quantity cannot exceed quantity to pick for: ${invalidItems.map(i => i.sku).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Get items that have changed quantities (use Number() to ensure consistent comparison)
      const changedItems = editableItems
        .filter((item) =>
          Number(item.newQuantityToPick) !== Number(item.quantityToPick) ||
          Number(item.newQuantityPicked) !== Number(item.quantityPicked)
        )
        .map((item) => ({
          id: item.id,
          quantityToPick: Number(item.newQuantityToPick),
          quantityPicked: Number(item.newQuantityPicked),
        }));

      console.log('[EditPickTicketDrawer] Submitting update:', {
        pickTicketId,
        changedItems,
        editableItems: editableItems.map(i => ({
          id: i.id,
          sku: i.sku,
          quantityToPick: i.quantityToPick,
          newQuantityToPick: i.newQuantityToPick,
          quantityPicked: i.quantityPicked,
          newQuantityPicked: i.newQuantityPicked,
        })),
      });

      const result = await updatePickTicket(pickTicketId, {
        status: data.status as PickTicketStatus,
        assignedTo: data.assignedTo || null,
        warehouseId: data.warehouseId || undefined,
        priority: data.priority as PickTicketPriority,
        notes: data.notes || null,
        specialInstructions: data.specialInstructions || null,
        items: changedItems.length > 0 ? changedItems : undefined,
      });

      if (result.success) {
        toast.success('Pick ticket updated successfully');
        onSuccess?.();
        onClose();
      } else {
        const errorMessage = 'error' in result ? result.error : 'Failed to update pick ticket';
        toast.error(errorMessage || 'Failed to update pick ticket');
      }
    } catch {
      toast.error('Failed to update pick ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantityToPickChange = (itemId: string, quantity: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, newQuantityToPick: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleQuantityPickedChange = (itemId: string, quantity: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, newQuantityPicked: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleQuantityBlur = (itemId: string) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        // Ensure picked <= to_pick
        const maxPicked = item.newQuantityToPick;
        if (item.newQuantityPicked > maxPicked) {
          return { ...item, newQuantityPicked: maxPicked };
        }
        return item;
      })
    );
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPickTicket(null);
      setUsers([]);
      setWarehouses([]);
      setEditableItems([]);
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${pickTicket?.pickTicketNumber || 'Pick Ticket'}`}
          </DialogTitle>
          <DialogDescription>
            Update pick ticket details
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : pickTicket ? (
          <Form {...form}>
            <form
              id="edit-pick-ticket-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* Status & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PICK_TICKET_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {PICK_TICKET_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              <Separator />

              {/* Assigned To */}
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <Select
                      value={field.value || 'unassigned'}
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)}
                      disabled={isSubmitting || isLoadingOptions}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingOptions ? 'Loading...' : 'Select user'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Warehouse */}
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || isLoadingOptions}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingOptions ? 'Loading...' : 'Select warehouse'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Items Table */}
              {editableItems.length > 0 && (
                <div className="space-y-3">
                  <Label>Items</Label>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">SKU</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[100px] text-right">Qty to Pick</TableHead>
                          <TableHead className="w-[100px] text-right">Picked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.description || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                value={item.newQuantityToPick}
                                onChange={(e) =>
                                  handleQuantityToPickChange(item.id, parseInt(e.target.value) || 0)
                                }
                                onBlur={() => handleQuantityBlur(item.id)}
                                disabled={isSubmitting}
                                className="h-8 w-20 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                max={item.newQuantityToPick}
                                value={item.newQuantityPicked}
                                onChange={(e) =>
                                  handleQuantityPickedChange(item.id, parseInt(e.target.value) || 0)
                                }
                                onBlur={() => handleQuantityBlur(item.id)}
                                disabled={isSubmitting}
                                className="h-8 w-20 text-right ml-auto"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />

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
                        className="min-h-[80px] resize-none"
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
                        className="min-h-[80px] resize-none"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
        ) : (
          <div className="text-center text-muted-foreground">
            Pick ticket not found
          </div>
        )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-pick-ticket-form"
            disabled={isSubmitting || isLoading || !pickTicket}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
