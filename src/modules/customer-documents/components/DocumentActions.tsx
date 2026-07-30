'use client';

/**
 * DocumentActions Component
 *
 * Dropdown menu with actions for a document row.
 */

import { MoreHorizontal, Eye, Download, RefreshCw, Archive } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { DocumentActionsProps } from '../types';

// ============================================
// COMPONENT
// ============================================

export function DocumentActions({
  document,
  onView,
  onDownload,
  onReplace,
  onArchive,
}: DocumentActionsProps) {
  const isArchived = document.status === 'archived';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye className="mr-2 h-4 w-4" />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        {!isArchived && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReplace}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Replace
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onArchive}
              className="text-destructive focus:text-destructive"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
