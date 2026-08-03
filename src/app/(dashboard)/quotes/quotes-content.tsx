'use client';

/**
 * Quotes Page Content
 *
 * Client component for managing quotes.
 * Uses server actions to fetch real data.
 *
 * State Management:
 * - Page component owns drawer state
 * - Quotes are fetched via useQuotes hook
 * - Data flows down via props
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

import {
  QuotesTable,
  ViewQuoteDrawer,
  CreateQuoteDrawer,
  EditQuoteDrawer,
  useQuotes,
} from '@/features/quotes';
import { deleteQuote, convertQuoteToSalesOrder } from '@/features/quotes/actions';
import type { QuoteListItem, QuoteStatus, QuoteWithItems } from '@/features/quotes/types';
import { QUOTE_STATUS_LABELS } from '@/features/quotes/types';

// ============================================
// COMPONENT
// ============================================

export function QuotesPageContent() {
  const router = useRouter();
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('quotes.create');
  const canViewDetail = hasMounted && hasPermission('quotes.view_detail');
  const canEdit = hasMounted && hasPermission('quotes.edit');
  const canDelete = hasMounted && hasPermission('quotes.delete');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Convert confirmation
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [quoteToConvert, setQuoteToConvert] = useState<QuoteListItem | QuoteWithItems | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Quotes list with status filter
  const {
    data: quotes,
    isLoading: isQuotesLoading,
    refetch: refetchQuotes,
  } = useQuotes(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Create
  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    refetchQuotes();
  }, [refetchQuotes]);

  // View
  const handleView = useCallback((quote: QuoteListItem) => {
    setSelectedQuoteId(quote.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedQuoteId(null);
  }, []);

  // Edit (can be triggered from view drawer or table actions)
  const handleEdit = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setSelectedQuoteId(quote.id);
    setIsViewDrawerOpen(false); // Close view drawer if open
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedQuoteId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    refetchQuotes();
  }, [refetchQuotes]);

  // Delete
  const handleDeleteClick = useCallback((quote: QuoteListItem) => {
    setQuoteToDelete(quote);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteQuote(quoteToDelete.id);
      if (result.success) {
        toast.success(`Quote ${quoteToDelete.quoteNumber} deleted`);
        refetchQuotes();
      } else {
        toast.error(result.error || 'Failed to delete quote');
      }
    } catch {
      toast.error('Failed to delete quote');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setQuoteToDelete(null);
  };

  // Convert to Sales Order
  const handleConvertClick = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setQuoteToConvert(quote);
    setConvertDialogOpen(true);
  }, []);

  const handleConvertConfirm = async () => {
    if (!quoteToConvert) {
      return;
    }

    setIsConverting(true);
    try {
      const result = await convertQuoteToSalesOrder(quoteToConvert.id);
      if (result.success && result.data) {
        toast.success(`Quote converted to Sales Order`);
        refetchQuotes();
        // Navigate to the new sales order
        router.push(`/sales-orders`);
      } else {
        toast.error(result.error || 'Failed to convert quote');
      }
    } catch {
      toast.error('Failed to convert quote');
    } finally {
      setIsConverting(false);
      setConvertDialogOpen(false);
      setQuoteToConvert(null);
    }
  };

  const handleConvertCancel = () => {
    setConvertDialogOpen(false);
    setQuoteToConvert(null);
  };

  // Row click (opens view drawer)
  const handleRowClick = useCallback((quote: QuoteListItem) => {
    handleView(quote);
  }, [handleView]);

  const handleRefresh = () => {
    refetchQuotes();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as QuoteStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Quotes"
        description="Manage customer quotes and proposals."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isQuotesLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isQuotesLoading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Create Quote
              </Button>
            )}
          </div>
        }
      />

      {/* Quotes Table */}
      <QuotesTable
        data={quotes}
        isLoading={isQuotesLoading}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onView={canViewDetail ? handleView : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        onConvert={canEdit ? handleConvertClick : undefined}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* View Quote Drawer */}
      <ViewQuoteDrawer
        quoteId={selectedQuoteId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
        onConvert={handleConvertClick}
      />

      {/* Create Quote Drawer */}
      <CreateQuoteDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Quote Drawer */}
      <EditQuoteDrawer
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        quoteId={selectedQuoteId}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quote{' '}
              <span className="font-semibold">{quoteToDelete?.quoteNumber}</span>?
              This action cannot be undone. Only draft quotes can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Quote to Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to convert quote{' '}
              <span className="font-semibold">{quoteToConvert?.quoteNumber}</span>{' '}
              to a sales order? This will create a new sales order and mark the quote as converted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConvertCancel} disabled={isConverting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertConfirm}
              disabled={isConverting}
            >
              {isConverting ? 'Converting...' : 'Convert to Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
