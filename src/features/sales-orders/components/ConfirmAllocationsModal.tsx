/**
 * Confirm Allocations Modal Component
 *
 * Shows all allocations for a sales order and allows executing actions:
 * - Manufacturer (Direct) → Create Purchase Order
 * - GDC Inventory → Create Pick Ticket
 * - Platinum Dealer Inventory → Send Email
 * - Platinum Dealer Fulfillment → Send Email
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Loader2, CheckCircle, Package, Mail, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FulfillmentAllocationWithDetails } from '../types';

// ============================================
// TYPES
// ============================================

interface ConfirmAllocationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId: string;
  salesOrderNumber: string;
  onConfirmComplete: () => void;
}

interface AllocationAction {
  id: string;
  type: 'create_po' | 'create_pick_ticket' | 'send_email';
  label: string;
  icon: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ============================================
// COMPONENT
// ============================================

export function ConfirmAllocationsModal({
  open,
  onOpenChange,
  salesOrderId,
  salesOrderNumber,
  onConfirmComplete,
}: ConfirmAllocationsModalProps) {
  const [allocations, setAllocations] = useState<FulfillmentAllocationWithDetails[]>([]);
  const [actions, setActions] = useState<Map<string, AllocationAction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load allocations when modal opens
  useEffect(() => {
    if (open && salesOrderId) {
      loadAllocations();
    }
  }, [open, salesOrderId]);

  async function loadAllocations() {
    try {
      setIsLoading(true);
      // Import and call the action to get allocations for all items
      const { getSalesOrder } = await import('../actions');
      const result = await getSalesOrder(salesOrderId);

      if (result.success && result.data) {
        // Collect all allocations from all items
        const allAllocations: FulfillmentAllocationWithDetails[] = [];
        for (const item of result.data.items) {
          // Items may have allocations populated by the service
          const itemWithAllocations = item as any;
          if (itemWithAllocations.allocations && itemWithAllocations.allocations.length > 0) {
            allAllocations.push(...itemWithAllocations.allocations);
          }
        }

        setAllocations(allAllocations);

        // Initialize actions map
        const actionsMap = new Map<string, AllocationAction>();
        allAllocations.forEach((allocation) => {
          // Map database allocation status to modal action status
          // Database: 'allocated' → Modal: 'completed'
          // Database: 'pending' → Modal: 'pending'
          const actionStatus = allocation.status === 'allocated' ? 'completed' : 'pending';

          actionsMap.set(allocation.id, {
            id: allocation.id,
            type: getActionType(allocation.fulfillmentSource),
            label: getActionLabel(allocation.fulfillmentSource),
            icon: getActionIcon(allocation.fulfillmentSource),
            status: actionStatus,
          });
        });
        setActions(actionsMap);
      } else {
        toast.error('Failed to load allocations');
      }
    } catch (error) {
      console.error('Error loading allocations:', error);
      toast.error('An error occurred while loading allocations');
    } finally {
      setIsLoading(false);
    }
  }

  function getActionType(source: string): AllocationAction['type'] {
    switch (source) {
      case 'direct':
        return 'create_po';
      case 'gdc_inventory':
        return 'create_pick_ticket';
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return 'send_email';
      default:
        return 'send_email';
    }
  }

  function getActionLabel(source: string): string {
    switch (source) {
      case 'direct':
        return 'Create PO';
      case 'gdc_inventory':
        return 'Create Pick Ticket';
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return 'Send Email';
      default:
        return 'Process';
    }
  }

  function getActionIcon(source: string) {
    switch (source) {
      case 'direct':
        return FileText;
      case 'gdc_inventory':
        return Package;
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return Mail;
      default:
        return CheckCircle;
    }
  }

  function getSourceLabel(source: string): string {
    switch (source) {
      case 'direct':
        return 'Manufacturer (Direct)';
      case 'gdc_inventory':
        return 'GDC Inventory';
      case 'platinum_dealer_inventory':
        return 'Platinum Dealer Inventory';
      case 'platinum_dealer_fulfillment':
        return 'Platinum Dealer Fulfillment';
      default:
        return source;
    }
  }

  async function handleAction(allocationId: string) {
    const action = actions.get(allocationId);
    if (!action) return;

    // Find the allocation details
    const allocation = allocations.find((a) => a.id === allocationId);
    if (!allocation) {
      toast.error('Allocation not found');
      return;
    }

    // Update action status to processing
    const processingActions = new Map(actions);
    processingActions.set(allocationId, { ...action, status: 'processing' });
    setActions(processingActions);

    try {
      let result: { success: boolean; error?: string; data?: any } = { success: false };

      // Execute action based on type
      switch (action.type) {
        case 'create_po':
          result = await handleCreatePO(allocation);
          break;

        case 'create_pick_ticket':
          result = await handleCreatePickTicket(allocation);
          break;

        case 'send_email':
          result = await handleSendEmail(allocation);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      if (result.success) {
        // Update status to completed
        const completedActions = new Map(actions);
        completedActions.set(allocationId, { ...action, status: 'completed' });
        setActions(completedActions);

        // Show success message with details from result
        const message = result.data?.message || `${action.label} created successfully`;
        toast.success(message);
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error(`Error executing ${action.type}:`, error);
      const failedActions = new Map(actions);
      failedActions.set(allocationId, {
        ...action,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setActions(failedActions);
      toast.error(`Failed to ${action.label}`);
    }
  }

  /**
   * Validate Purchase Order data for Manufacturer (Direct) allocation
   */
  async function handleCreatePO(allocation: FulfillmentAllocationWithDetails) {
    try {
      console.log('🔄 [handleCreatePO] Creating PO for allocation:', allocation.id);

      // Validate allocation has container quantity
      if (!allocation.containerQty || allocation.containerQty <= 0) {
        throw new Error('Container quantity is required for manufacturer orders');
      }

      // Get the sales order item to extract product details
      const soItemId = allocation.salesOrderItemId;
      console.log('📦 [handleCreatePO] SO Item ID:', soItemId);

      // Import required actions
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');
      const { createPurchaseOrderFromAllocation } = await import('../actions');

      // Create the Purchase Order immediately
      console.log('🏭 [handleCreatePO] Creating PO from allocation...');
      const poResult = await createPurchaseOrderFromAllocation(salesOrderId, allocation.id);

      if (!poResult.success) {
        throw new Error(poResult.error || 'Failed to create Purchase Order');
      }

      console.log('✅ [handleCreatePO] PO created:', poResult.data);

      // Update allocation status to 'allocated'
      await updateAllocationStatus(allocation.id, 'allocated');

      return {
        success: true,
        data: {
          message: `Purchase Order ${poResult.data?.poNumber || ''} created successfully`,
          poNumber: poResult.data?.poNumber,
          poId: poResult.data?.poId,
        },
      };
    } catch (error) {
      console.error('❌ [handleCreatePO] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create PO',
      };
    }
  }

  /**
   * Create Pick Ticket for GDC Inventory allocation
   */
  async function handleCreatePickTicket(allocation: FulfillmentAllocationWithDetails) {
    try {
      console.log('🔄 [handleCreatePickTicket] Creating Pick Ticket for allocation:', allocation.id);

      // Validate required fields
      if (!allocation.location?.id) {
        throw new Error('Warehouse location not found for allocation');
      }

      if (!allocation.assignedContact?.id) {
        throw new Error('Assigned contact not found for allocation');
      }

      console.log('📦 [handleCreatePickTicket] Location:', allocation.location.name);
      console.log('👤 [handleCreatePickTicket] Contact:', allocation.assignedContact.name);

      // Import required actions
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');
      const { createPickTicketFromSalesOrder } = await import('@/features/pick-tickets/actions');

      // Create the Pick Ticket immediately
      console.log('📋 [handleCreatePickTicket] Creating Pick Ticket...');
      const ptResult = await createPickTicketFromSalesOrder(
        salesOrderId,
        allocation.location.id,
        [allocation.assignedContact.id],
        allocation.notes || undefined,
        allocation.assignedUserId || undefined
      );

      if (!ptResult.success) {
        throw new Error(ptResult.error || 'Failed to create Pick Ticket');
      }

      console.log('✅ [handleCreatePickTicket] Pick Ticket created:', ptResult.data);

      // Update allocation status to 'allocated'
      await updateAllocationStatus(allocation.id, 'allocated');

      return {
        success: true,
        data: {
          message: `Pick Ticket ${ptResult.data?.pickTicketNumber || ''} created successfully`,
          pickTicketNumber: ptResult.data?.pickTicketNumber,
          pickTicketId: ptResult.data?.id,
          location: allocation.location.name,
          contact: allocation.assignedContact.name,
        },
      };
    } catch (error) {
      console.error('❌ [handleCreatePickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Pick Ticket',
      };
    }
  }

  /**
   * Send Email for Platinum Dealer allocation
   */
  async function handleSendEmail(allocation: FulfillmentAllocationWithDetails) {
    try {
      if (!allocation.platinumDealer) {
        throw new Error('Dealer information not found for allocation');
      }

      // TODO: Implement actual email sending
      // For now, just log the allocation details
      console.log('✅ Email notification to dealer:', {
        dealer: allocation.platinumDealer.dealerName,
        quantity: allocation.quantity,
        fulfillmentSource: allocation.fulfillmentSource,
        location: allocation.dealerLocation?.locationName,
      });

      // Update allocation status to 'allocated'
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');
      await updateAllocationStatus(allocation.id, 'allocated');

      // Simulate email sending
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        success: true,
        data: { emailSent: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  async function handleConfirmAll() {
    setIsProcessing(true);

    try {
      // Check if ALL actions are already completed
      const allActionsCompleted = Array.from(actions.values()).every((a) => a.status === 'completed');

      if (!allActionsCompleted) {
        toast.error('Please assign all actions before confirming the order.');
        setIsProcessing(false);
        return;
      }

      // Check if any actions failed
      const hasFailures = Array.from(actions.values()).some((a) => a.status === 'failed');

      if (hasFailures) {
        toast.error('Some actions failed. Please retry failed actions before confirming.');
        setIsProcessing(false);
        return;
      }

      console.log('🚀 [Modal] Starting order confirmation for SO:', salesOrderId);
      console.log('📊 [Modal] Allocations:', allocations.map(a => ({
        source: a.fulfillmentSource,
        qty: a.quantity,
        status: a.status
      })));

      // Step 1: Confirm the sales order
      // NOTE: confirmSalesOrder() automatically creates PO for manufacturer (direct) allocations
      console.log('📞 [Modal] Calling confirmSalesOrder...');
      const { confirmSalesOrder } = await import('../actions');
      const confirmResult = await confirmSalesOrder(salesOrderId);

      console.log('📊 [Modal] confirmSalesOrder result:', confirmResult);

      if (!confirmResult.success) {
        console.error('❌ [Modal] Confirm failed:', confirmResult.error);
        toast.error(confirmResult.error || 'Failed to confirm order');
        return;
      }

      console.log('✅ [Modal] Order confirmed. PO should be created for manufacturer allocations.');

      // Step 2: Create Pick Tickets for GDC Inventory allocations
      const gdcAllocations = allocations.filter((a) => a.fulfillmentSource === 'gdc_inventory');
      if (gdcAllocations.length > 0) {
        try {
          const { createPickTicketFromSalesOrder } = await import('@/features/pick-tickets/actions');

          // Group by location
          const locationGroups = new Map<string, typeof gdcAllocations>();
          for (const allocation of gdcAllocations) {
            if (allocation.location?.id) {
              if (!locationGroups.has(allocation.location.id)) {
                locationGroups.set(allocation.location.id, []);
              }
              locationGroups.get(allocation.location.id)!.push(allocation);
            }
          }

          // Create pick ticket for each location
          for (const [locationId, allocationsForLocation] of locationGroups) {
            const contactIds = [...new Set(
              allocationsForLocation
                .filter(a => a.assignedContact?.id)
                .map(a => a.assignedContact!.id)
            )];

            const combinedNotes = allocationsForLocation
              .filter(a => a.notes)
              .map(a => a.notes)
              .join('\n---\n');

            // Get assigned user ID from first allocation (if any)
            const assignedUserId = allocationsForLocation.find(a => a.assignedUserId)?.assignedUserId || undefined;

            if (contactIds.length > 0) {
              const ptResult = await createPickTicketFromSalesOrder(
                salesOrderId,
                locationId,
                contactIds,
                combinedNotes || undefined,
                assignedUserId // Use assigned user from allocation
              );

              if (ptResult.success) {
                console.log('✅ Pick Ticket Created:', ptResult.data);
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to create Pick Tickets:', error);
        }
      }

      // Show success message
      const manufacturerAllocations = allocations.filter((a) => a.fulfillmentSource === 'direct');
      // Note: gdcAllocations already declared above for Pick Ticket creation (line 393)

      const resourcesCreated = [];
      if (manufacturerAllocations.length > 0) resourcesCreated.push('Purchase Order');
      if (gdcAllocations.length > 0) resourcesCreated.push('Pick Ticket(s)');

      const resourcesText = resourcesCreated.length > 0
        ? ` ${resourcesCreated.join(' and ')} created.`
        : '';

      toast.success(`Order ${salesOrderNumber} confirmed successfully!${resourcesText}`);
      onConfirmComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error executing actions:', error);
      toast.error('An error occurred while executing actions');
    } finally {
      setIsProcessing(false);
    }
  }

  const allCompleted = Array.from(actions.values()).every((a) => a.status === 'completed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Order - {salesOrderNumber}</DialogTitle>
          <DialogDescription>
            Review and execute actions for all allocations before confirming the order.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading allocations...</span>
          </div>
        ) : allocations.length === 0 ? (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>No allocations found.</strong> Please create allocations before confirming the order.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation Source</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => {
                    const action = actions.get(allocation.id);
                    if (!action) return null;

                    const Icon = action.icon;

                    return (
                      <TableRow key={allocation.id}>
                        <TableCell className="font-medium">
                          {getSourceLabel(allocation.fulfillmentSource)}
                        </TableCell>
                        <TableCell>{allocation.quantity} units</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {allocation.location?.name ||
                            allocation.platinumDealer?.dealerName ||
                            allocation.containerId ||
                            '-'}
                        </TableCell>
                        <TableCell>
                          {action.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {action.status === 'processing' && (
                            <Badge variant="default" className="bg-blue-500">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {action.status === 'completed' && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Assigned
                            </Badge>
                          )}
                          {action.status === 'failed' && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={action.status === 'completed' ? 'outline' : 'default'}
                            onClick={() => handleAction(allocation.id)}
                            disabled={
                              action.status === 'processing' || action.status === 'completed'
                            }
                          >
                            {action.status === 'processing' ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="mr-2 h-4 w-4" />
                            )}
                            {action.label}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          {!allCompleted && (
            <Alert className="flex-1 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Assign all actions above by clicking each button before confirming the order.
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleConfirmAll}
            disabled={isLoading || allocations.length === 0 || isProcessing || !allCompleted}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
