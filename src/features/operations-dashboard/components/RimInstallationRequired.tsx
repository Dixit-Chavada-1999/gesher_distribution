'use client';

/**
 * Rim Installation Required Component
 *
 * Shows inventory items that need rim installation:
 * - GDC1 No.
 * - Load #
 * - 290/85R38 CW Qty
 * - Bead Lock Qty
 * - Total Qty
 * - Status
 * - Action Required / Notes
 */

import { Wrench, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { RimInstallationItem } from '../types';

// ============================================
// TYPES
// ============================================

interface RimInstallationRequiredProps {
  data: RimInstallationItem[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RimInstallationRequired({ data }: RimInstallationRequiredProps) {
  const totalUnits = data.reduce((sum, item) => sum + item.totalQty, 0);

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <Wrench className="h-4 w-4" />
              Rim Installation Required - GDC No. {data[0]?.gdc1No}-{data[data.length - 1]?.gdc1No}
            </CardTitle>
            <CardDescription className="text-amber-700">
              {data.length} loads / {formatNumber(totalUnits)} units need rim installation - TWS manufacturer
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Action Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-100/50">
              <TableHead>GDC1 No.</TableHead>
              <TableHead>Load #</TableHead>
              <TableHead className="text-right">290/85R38 CW</TableHead>
              <TableHead className="text-right">Bead Lock</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action Required / Notes</TableHead>
              <TableHead>Executive Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id} className="hover:bg-amber-50">
                <TableCell className="font-medium">{item.gdc1No}</TableCell>
                <TableCell>{item.loadNumber}</TableCell>
                <TableCell className="text-right">{item.sku290_85R38Qty}</TableCell>
                <TableCell className="text-right">{item.beadLockQty}</TableCell>
                <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-amber-700 font-medium">
                  {item.actionRequired}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                  {item.executiveNote}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-amber-100/50 font-medium">
              <TableCell colSpan={2}>Total units requiring rim installation</TableCell>
              <TableCell className="text-right">
                {formatNumber(data.reduce((sum, item) => sum + item.sku290_85R38Qty, 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(data.reduce((sum, item) => sum + item.beadLockQty, 0))}
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatNumber(totalUnits)}
              </TableCell>
              <TableCell colSpan={3} />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
