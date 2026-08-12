'use client';

/**
 * SKU Breakdown Component
 *
 * Shows SKU quantity breakdown:
 * - Supplier Outstanding Qty
 * - GDC1 Available Inventory
 * - Combined Qty
 * - Share of Combined (percentage)
 */

import { Package } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { SKUBreakdown as SKUBreakdownType } from '../types';

// ============================================
// TYPES
// ============================================

interface SKUBreakdownProps {
  data: SKUBreakdownType[];
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

export function SKUBreakdown({ data }: SKUBreakdownProps) {
  const totalSupplier = data.reduce((sum, item) => sum + item.supplierOutstandingQty, 0);
  const totalGDC1 = data.reduce((sum, item) => sum + item.gdc1AvailableInventory, 0);
  const totalCombined = data.reduce((sum, item) => sum + item.combinedQty, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              SKU Quantity Breakdown - Supplier + GDC1 Inventory
            </CardTitle>
            <CardDescription>Combined inventory across locations</CardDescription>
          </div>
          <div className="text-sm text-right">
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold">{formatNumber(totalCombined)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Supplier Outstanding</TableHead>
              <TableHead className="text-right">GDC1 Available</TableHead>
              <TableHead className="text-right">Combined Qty</TableHead>
              <TableHead className="text-right w-[150px]">Share of Combined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.sku}>
                <TableCell className="font-medium">{item.skuName}</TableCell>
                <TableCell className="text-right text-blue-600">
                  {formatNumber(item.supplierOutstandingQty)}
                </TableCell>
                <TableCell className="text-right text-emerald-600">
                  {formatNumber(item.gdc1AvailableInventory)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatNumber(item.combinedQty)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Progress
                      value={item.shareOfCombined}
                      className="w-[60px] h-2"
                    />
                    <span className="text-sm w-[45px] text-right">
                      {item.shareOfCombined.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right text-blue-600">
                {formatNumber(totalSupplier)}
              </TableCell>
              <TableCell className="text-right text-emerald-600">
                {formatNumber(totalGDC1)}
              </TableCell>
              <TableCell className="text-right font-bold">
                {formatNumber(totalCombined)}
              </TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
