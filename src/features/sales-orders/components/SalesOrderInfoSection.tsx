'use client';

/**
 * SalesOrderInfoSection Component
 *
 * Section 1 of the Sales Order form.
 * Contains order information fields.
 *
 * Uses react-hook-form context for form state management.
 * All data is received via props - no internal data fetching.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */

import { memo, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import type { SalesOrderInfoSectionProps } from '../types';
import { ORDER_STATUS_LABELS, type OrderStatus } from '../types';
import type { SalesOrderFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

function SalesOrderInfoSectionComponent({
  customers,
  salesReps,
  warehouses,
  currencies,
}: SalesOrderInfoSectionProps) {
  const { register, control } = useFormContext<SalesOrderFormInput>();

  // Memoized order statuses
  const orderStatuses = useMemo<OrderStatus[]>(() => [
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ], []);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Sales Order Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Basic order details and customer information.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Sales Order Number */}
        <div className="space-y-2">
          <Label htmlFor="orderNumber">Sales Order Number</Label>
          <Input
            id="orderNumber"
            placeholder="Auto-generated"
            disabled
            className="bg-muted"
            {...register('orderNumber')}
          />
        </div>

        {/* Order Date */}
        <div className="space-y-2">
          <Label htmlFor="orderDate">Order Date *</Label>
          <Input
            id="orderDate"
            type="date"
            {...register('orderDate')}
          />
        </div>

        {/* Requested Delivery Date */}
        <div className="space-y-2">
          <Label htmlFor="requestedDeliveryDate">Requested Delivery Date *</Label>
          <Input
            id="requestedDeliveryDate"
            type="date"
            {...register('requestedDeliveryDate')}
          />
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer *</Label>
          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Sales Representative */}
        <div className="space-y-2">
          <Label htmlFor="salesRepId">Sales Representative</Label>
          <Controller
            name="salesRepId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="salesRepId">
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Warehouse */}
        <div className="space-y-2">
          <Label htmlFor="warehouseId">Warehouse</Label>
          <Controller
            name="warehouseId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="warehouseId">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currencyId">Currency</Label>
          <Controller
            name="currencyId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'USD'} onValueChange={field.onChange}>
                <SelectTrigger id="currencyId">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Customer PO Number */}
        <div className="space-y-2">
          <Label htmlFor="customerPoNumber">Customer PO Number</Label>
          <Input
            id="customerPoNumber"
            placeholder="Enter PO number"
            {...register('customerPoNumber')}
          />
        </div>

        {/* Order Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Order Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'draft'} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {orderStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// Export memoized component
export const SalesOrderInfoSection = memo(SalesOrderInfoSectionComponent);
