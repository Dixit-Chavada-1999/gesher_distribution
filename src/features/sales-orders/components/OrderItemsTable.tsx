'use client';

/**
 * OrderItemsTable Component
 *
 * Section 3 of the Sales Order form.
 * Enterprise editable table for order line items.
 *
 * Design Goals:
 * - Completely reusable and extensible
 * - Future features (warehouse, batch, serial, inventory) can be added
 *   via columnConfig without rewriting the component
 * - Receives all data via props (products, units, taxRates)
 * - Supports product price auto-fill via callback
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized row component for efficient table rendering
 * - Memoized callbacks with useCallback
 */

import { memo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { OrderItemsTableProps, OrderItem } from '../types';
import { createEmptyOrderItem, formatCurrency } from '../lib/mock-data';

// ============================================
// TYPES
// ============================================

interface OrderItemRowProps {
  item: OrderItem;
  index: number;
  products: OrderItemsTableProps['products'];
  units: OrderItemsTableProps['units'];
  taxRates: OrderItemsTableProps['taxRates'];
  onItemChange: (itemId: string, field: string, value: string | number) => void;
  onRemove: (itemId: string) => void;
}

// ============================================
// MEMOIZED ROW COMPONENT
// ============================================

const OrderItemRow = memo(function OrderItemRow({
  item,
  products,
  units,
  taxRates,
  onItemChange,
  onRemove,
}: OrderItemRowProps) {
  // Item ID is required for all handlers
  const itemId = item.id || '';

  // Memoized handlers
  const handleProductChange = useCallback(
    (value: string) => onItemChange(itemId, 'productId', value),
    [itemId, onItemChange]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'description', e.target.value),
    [itemId, onItemChange]
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'quantity', Number(e.target.value)),
    [itemId, onItemChange]
  );

  const handleUnitChange = useCallback(
    (value: string) => onItemChange(itemId, 'unitId', value),
    [itemId, onItemChange]
  );

  const handleUnitPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'unitPrice', Number(e.target.value)),
    [itemId, onItemChange]
  );

  const handleDiscountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'discountPercent', Number(e.target.value)),
    [itemId, onItemChange]
  );

  const handleTaxRateChange = useCallback(
    (value: string) => onItemChange(itemId, 'taxRateId', value),
    [itemId, onItemChange]
  );

  const handleRemove = useCallback(
    () => onRemove(itemId),
    [itemId, onRemove]
  );

  return (
    <TableRow>
      {/* Product Select */}
      <TableCell>
        <Select
          value={item.productId || undefined}
          onValueChange={handleProductChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* SKU (Read-only) */}
      <TableCell>
        <Input
          value={item.sku || ''}
          readOnly
          className="h-9 bg-muted font-mono text-sm w-full"
        />
      </TableCell>

      {/* Description */}
      <TableCell className="max-w-[200px]">
        <Input
          value={item.description || ''}
          onChange={handleDescriptionChange}
          className="h-9 w-full truncate"
          placeholder="Description"
        />
      </TableCell>

      {/* Quantity */}
      <TableCell>
        <Input
          type="number"
          min={1}
          value={item.quantity || ''}
          onChange={handleQuantityChange}
          className="h-9 text-right w-full"
        />
      </TableCell>

      {/* Unit */}
      <TableCell>
        <Select
          value={item.unitId || 'EA'}
          onValueChange={handleUnitChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.code}>
                {unit.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Unit Price */}
      <TableCell>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={item.unitPrice}
          onChange={handleUnitPriceChange}
          className="h-9 text-right"
        />
      </TableCell>

      {/* Discount % */}
      <TableCell>
        <Input
          type="number"
          min={0}
          max={100}
          value={item.discountPercent}
          onChange={handleDiscountChange}
          className="h-9 text-right"
        />
      </TableCell>

      {/* Tax Rate */}
      <TableCell>
        <Select
          value={item.taxRateId || undefined}
          onValueChange={handleTaxRateChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taxRates.map((rate) => (
              <SelectItem key={rate.id} value={rate.id}>
                {rate.name} ({rate.rate}%)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Line Total (Read-only) */}
      <TableCell className="text-right font-medium">
        {formatCurrency(item.lineTotal)}
      </TableCell>

      {/* Remove Button */}
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove line</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function OrderItemsTableComponent({
  products,
  units,
  taxRates,
  items,
  onItemsChange,
  onProductSelect,
  columnConfig: _columnConfig = {},
}: OrderItemsTableProps) {
  // ----------------------------------------
  // MEMOIZED HANDLERS
  // ----------------------------------------

  const handleAddLine = useCallback(() => {
    const newItem = createEmptyOrderItem();
    onItemsChange([...items, newItem]);
  }, [items, onItemsChange]);

  const handleRemoveLine = useCallback((itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId));
  }, [items, onItemsChange]);

  const handleItemChange = useCallback((
    itemId: string,
    field: string,
    value: string | number
  ) => {
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {return;}

    onItemsChange(
      items.map((item, index) => {
        if (item.id !== itemId) {return item;}

        const updatedItem = { ...item, [field]: value };

        // When product is selected, trigger callback for server-side price lookup
        if (field === 'productId' && typeof value === 'string') {
          if (onProductSelect) {
            // Let the parent handle the product data fetch
            onProductSelect(index, value);
          } else {
            // Fallback to local product data (mock behavior)
            const product = products.find((p) => p.id === value);
            if (product) {
              updatedItem.sku = product.sku;
              updatedItem.description = product.description;
              updatedItem.unitPrice = product.unitPrice;
              // Keep existing unitId or default to 'EA'
              if (!updatedItem.unitId) {
                updatedItem.unitId = 'EA';
              }
            }
          }
        }

        // Recalculate line total
        const quantity = field === 'quantity' ? Number(value) : updatedItem.quantity;
        const unitPrice = field === 'unitPrice' ? Number(value) : updatedItem.unitPrice;
        const discountPercent =
          field === 'discountPercent' ? Number(value) : updatedItem.discountPercent;

        const subtotal = quantity * unitPrice;
        const discountAmount = subtotal * (discountPercent / 100);
        updatedItem.lineTotal = subtotal - discountAmount;

        return updatedItem;
      })
    );
  }, [items, onItemsChange, onProductSelect, products]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Order Items</h3>
          <p className="text-sm text-muted-foreground">
            Add products to this sales order.
          </p>
        </div>
        <Button type="button" onClick={handleAddLine} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Line
        </Button>
      </div>

      <Separator />

      {/* Items Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Product</TableHead>
              <TableHead className="w-[130px]">SKU</TableHead>
              <TableHead className="min-w-[150px]">Description</TableHead>
              <TableHead className="w-[70px] text-right">Qty</TableHead>
              <TableHead className="w-[70px]">Unit</TableHead>
              <TableHead className="w-[100px] text-right">Unit Price</TableHead>
              <TableHead className="w-[70px] text-right">Disc %</TableHead>
              <TableHead className="w-[130px]">Tax</TableHead>
              <TableHead className="w-[110px] text-right">Line Total</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-24 text-center text-muted-foreground"
                >
                  No items added. Click &quot;Add Line&quot; to add products.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <OrderItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  products={products}
                  units={units}
                  taxRates={taxRates}
                  onItemChange={handleItemChange}
                  onRemove={handleRemoveLine}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Line Button (Bottom) */}
      {items.length > 0 && (
        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={handleAddLine} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Line
          </Button>
        </div>
      )}
    </div>
  );
}

// Export memoized component
export const OrderItemsTable = memo(OrderItemsTableComponent);
