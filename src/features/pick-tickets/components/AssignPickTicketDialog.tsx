'use client';

/**
 * AssignPickTicketDialog Component
 *
 * Dialog to assign a pick ticket to a warehouse worker.
 */

import { useState, useEffect } from 'react';
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';

import { assignPickTicket } from '../actions';
import { getUsers } from '@/features/users/actions';
import type { PickTicketListItem } from '../types';

// ============================================
// TYPES
// ============================================

interface AssignPickTicketDialogProps {
  pickTicket: PickTicketListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

// ============================================
// COMPONENT
// ============================================

export function AssignPickTicketDialog({
  pickTicket,
  open,
  onClose,
  onSuccess,
}: AssignPickTicketDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch users when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsers();
      // Pre-select current assignee if exists
      setSelectedUserId(pickTicket?.assignedTo || '');
    }
  }, [open, pickTicket?.assignedTo]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const result = await getUsers({ status: 'active', limit: 100 });
      if (result.success && result.data) {
        // Map to simple user options - data is { data: UserTableRow[], meta: {...} }
        const userData = result.data as { data: Array<{
          id: string;
          fullName: string;
          email: string;
          roleScope: string | null;
        }> };
        // Filter out supplier users - only show internal users for pick ticket assignment
        const userOptions = (userData.data || [])
          .filter((user) => user.roleScope !== 'supplier')
          .map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
          }));
        setUsers(userOptions);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAssign = async () => {
    if (!pickTicket || !selectedUserId) {
      return;
    }

    setIsAssigning(true);
    try {
      const result = await assignPickTicket(pickTicket.id, selectedUserId);
      if (result.success) {
        const assignedUser = users.find(u => u.id === selectedUserId);
        toast.success(
          `Assigned ${pickTicket.pickTicketNumber} to ${assignedUser?.fullName}`
        );
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to assign pick ticket');
      }
    } catch (error) {
      console.error('Failed to assign pick ticket:', error);
      toast.error('Failed to assign pick ticket');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedUserId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Assign Pick Ticket
          </DialogTitle>
          <DialogDescription>
            Assign <span className="font-semibold">{pickTicket?.pickTicketNumber}</span> to a
            warehouse worker for picking.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="assignee">Assign To</Label>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a worker..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({user.email})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedUserId}>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
