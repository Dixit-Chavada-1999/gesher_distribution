'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Progress } from '@/shared/components/ui/progress';
import {
  Pencil,
  Play,
  Package,
  Warehouse,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { usePickTicket } from '../hooks/usePickTicket';
import { createPackingListFromPickTicket } from '../actions/packing-list.actions';
import {
  PICK_TICKET_STATUS_COLORS,
  PICK_TICKET_STATUS_LABELS,
  PICK_TICKET_PRIORITY_COLORS,
  PICK_TICKET_PRIORITY_LABELS,
} from '../types';
import type { ViewPickTicketDrawerProps } from '../types';

export function ViewPickTicketDrawer({
  open,
  onClose,
  pickTicketId,
  onEdit,
  onStartPicking,
  onPackingListCreated,
}: ViewPickTicketDrawerProps) {
  const { data: pickTicket, isLoading, refetch } = usePickTicket(open ? pickTicketId : null);
  const [isCreatingPackingList, setIsCreatingPackingList] = useState(false);

  const canEdit = pickTicket && ['pending', 'assigned'].includes(pickTicket.status);
  const canStartPicking = pickTicket && pickTicket.status === 'assigned';
  const canCreatePackingList = pickTicket && pickTicket.status === 'picked' && !pickTicket.packingList;

  const handleCreatePackingList = async () => {
    if (!pickTicket) { return; }

    setIsCreatingPackingList(true);
    try {
      const result = await createPackingListFromPickTicket(pickTicket.id);
      if (result.success) {
        toast.success('Packing list created successfully');
        refetch();
        onPackingListCreated?.();
      } else {
        toast.error(result.error || 'Failed to create packing list');
      }
    } catch {
      toast.error('Failed to create packing list');
    } finally {
      setIsCreatingPackingList(false);
    }
  };

  // Calculate progress
  const totalQuantity = pickTicket?.items.reduce((sum, item) => sum + item.quantityToPick, 0) || 0;
  const pickedQuantity = pickTicket?.items.reduce((sum, item) => sum + item.quantityPicked, 0) || 0;
  const progressPercentage = totalQuantity > 0 ? Math.round((pickedQuantity / totalQuantity) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : pickTicket ? (
                <>
                  <SheetTitle className="text-xl">{pickTicket.pickTicketNumber}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(pickTicket.createdAt).toLocaleDateString()}
                  </p>
                </>
              ) : null}
            </div>
            {pickTicket && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium',
                    PICK_TICKET_PRIORITY_COLORS[pickTicket.priority]
                  )}
                >
                  {PICK_TICKET_PRIORITY_LABELS[pickTicket.priority]}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium',
                    PICK_TICKET_STATUS_COLORS[pickTicket.status]
                  )}
                >
                  {PICK_TICKET_STATUS_LABELS[pickTicket.status]}
                </Badge>
              </div>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : pickTicket ? (
          <div className="mt-6 space-y-6">
            {/* Progress Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Picking Progress
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items Picked</span>
                  <span className="font-medium">{pickedQuantity} / {totalQuantity}</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </div>

            <Separator />

            {/* Sales Order Information */}
            {pickTicket.salesOrder && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sales Order
                </h3>
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium font-mono">{pickTicket.salesOrder.orderNumber}</p>
                    <p className="text-muted-foreground">{pickTicket.salesOrder.customerName}</p>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Warehouse & Assignment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Warehouse & Assignment
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Warehouse</p>
                    <p className="font-medium">
                      {pickTicket.warehouse?.name || 'Not specified'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Assigned To</p>
                    <p className="font-medium">
                      {pickTicket.assignedUser
                        ? `${pickTicket.assignedUser.firstName} ${pickTicket.assignedUser.lastName}`
                        : <span className="italic text-muted-foreground">Unassigned</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({pickTicket.items.length})
              </h3>
              <div className="space-y-2">
                {pickTicket.items.map((item) => {
                  const isPicked = item.quantityPicked >= item.quantityToPick;
                  const isPartial = item.quantityPicked > 0 && item.quantityPicked < item.quantityToPick;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg',
                        isPicked ? 'bg-emerald-50' : isPartial ? 'bg-amber-50' : 'bg-muted/50'
                      )}
                    >
                      {isPicked ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                      ) : isPartial ? (
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{item.sku}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                            {item.binLocation && (
                              <p className="text-xs text-blue-600 mt-1">
                                Bin: {item.binLocation}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'text-sm font-medium',
                              isPicked ? 'text-emerald-600' : ''
                            )}>
                              {item.quantityPicked} / {item.quantityToPick}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes & Instructions */}
            {(pickTicket.notes || pickTicket.specialInstructions) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {pickTicket.specialInstructions && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Special Instructions
                      </h3>
                      <p className="text-sm whitespace-pre-wrap bg-amber-50 p-3 rounded-lg border border-amber-200">
                        {pickTicket.specialInstructions}
                      </p>
                    </div>
                  )}
                  {pickTicket.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{pickTicket.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex gap-2">
              {onStartPicking && canStartPicking && (
                <Button onClick={() => onStartPicking(pickTicket)} className="flex-1">
                  <Play className="mr-2 h-4 w-4" />
                  Start Picking
                </Button>
              )}
              {canCreatePackingList && (
                <Button
                  onClick={handleCreatePackingList}
                  disabled={isCreatingPackingList}
                  className="flex-1"
                >
                  {isCreatingPackingList ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardList className="mr-2 h-4 w-4" />
                  )}
                  Create Packing List
                </Button>
              )}
              {pickTicket.packingList && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                  Packing List: {pickTicket.packingList.packingListNumber}
                </Badge>
              )}
              {onEdit && canEdit && (
                <Button onClick={() => onEdit(pickTicket)} variant="outline" className="flex-1">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Pick ticket not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
