'use client';

/**
 * SalesOrderForm Component
 *
 * Main form component that composes all sections.
 * Manages local form state and coordinates section components.
 *
 * Design Principles:
 * - Receives all master data via props
 * - Each section receives only what it needs
 * - Auto-fill for customer addresses and product prices
 * - Submits to server action
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 * - Memoized computed values with useMemo
 */

import { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { SalesOrderInfoSection } from './SalesOrderInfoSection';
import { BillingShippingSection } from './BillingShippingSection';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderSummaryCards } from './OrderSummaryCards';
import { NotesSection } from './NotesSection';

import type { SalesOrderFormProps } from '../types';
import { salesOrderFormSchema } from '../lib/schemas';
import { getCustomerAddresses, getProductPrice } from '../actions';
import { createEmptyOrderItem } from '../lib/mock-data';

// ============================================
// DEFAULT VALUES
// ============================================

const getDefaultFormValues = () => ({
  orderNumber: '',
  orderDate: new Date().toISOString().split('T')[0],
  requestedDeliveryDate: '',
  customerId: '',
  salesRepId: '',
  warehouseId: '',
  currencyId: 'USD',
  customerPoNumber: '',
  status: 'draft' as const,
  billingAddress: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  },
  shippingAddress: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  },
  shippingMethodId: '',
  items: [createEmptyOrderItem()],
  customerNotes: '',
  internalNotes: '',
});

// ============================================
// COMPONENT
// ============================================

function SalesOrderFormComponent({
  masterData,
  initialData,
  onSubmit,
  onCancel: _onCancel,
  onSaveDraft: _onSaveDraft,
}: SalesOrderFormProps) {
  // ----------------------------------------
  // FORM SETUP
  // ----------------------------------------

  const methods = useForm({
    resolver: zodResolver(salesOrderFormSchema),
    defaultValues: {
      ...getDefaultFormValues(),
      ...initialData,
    },
    mode: 'onBlur',
  });

  const { watch, setValue, handleSubmit } = methods;

  // Watch form values for auto-calculations and auto-fill
  const customerId = watch('customerId');
  const items = watch('items');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // ----------------------------------------
  // AUTO-FILL: Customer Addresses
  // ----------------------------------------

  const handleCustomerChange = useCallback(async (newCustomerId: string) => {
    if (!newCustomerId) {
      // Clear addresses if no customer selected
      setValue('billingAddress', getDefaultFormValues().billingAddress);
      setValue('shippingAddress', getDefaultFormValues().shippingAddress);
      return;
    }

    setIsLoadingAddresses(true);
    try {
      const result = await getCustomerAddresses(newCustomerId);

      if (result.success && result.data) {
        const { billing, shipping } = result.data;

        setValue('billingAddress', {
          street: billing.street || '',
          city: billing.city || '',
          state: billing.state || '',
          postalCode: billing.postalCode || '',
          country: billing.country || 'US',
        });

        setValue('shippingAddress', {
          street: shipping.street || '',
          city: shipping.city || '',
          state: shipping.state || '',
          postalCode: shipping.postalCode || '',
          country: shipping.country || 'US',
        });
      }
    } catch (error) {
      console.error('Failed to fetch customer addresses:', error);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [setValue]);

  // Effect to auto-fill addresses when customer changes
  useEffect(() => {
    if (customerId) {
      handleCustomerChange(customerId);
    }
  }, [customerId, handleCustomerChange]);

  // ----------------------------------------
  // AUTO-FILL: Product Price
  // ----------------------------------------

  const handleProductSelect = useCallback(async (
    itemIndex: number,
    productId: string
  ) => {
    if (!productId) {return;}

    try {
      const result = await getProductPrice(productId);

      if (result.success && result.data) {
        const currentItems = methods.getValues('items');
        const updatedItems = [...currentItems];
        const currentItem = updatedItems[itemIndex];
        const quantity = Number(currentItem?.quantity ?? 1);
        const discountPercent = Number(currentItem?.discountPercent ?? 0);
        const unitPrice = result.data.unitPrice / 100; // Convert cents to dollars

        updatedItems[itemIndex] = {
          id: currentItem?.id,
          productId,
          sku: result.data.sku,
          description: result.data.name + (result.data.description ? ` - ${result.data.description}` : ''),
          quantity,
          unitId: currentItem?.unitId || 'EA',
          unitPrice,
          discountPercent,
          taxRateId: currentItem?.taxRateId || 'tax-003',
          lineTotal: calculateLineTotal(quantity, unitPrice, discountPercent),
          warehouseId: currentItem?.warehouseId,
          batchNumber: currentItem?.batchNumber,
          serialNumber: currentItem?.serialNumber,
        };
        setValue('items', updatedItems);
      }
    } catch (error) {
      console.error('Failed to fetch product price:', error);
    }
  }, [methods, setValue]);

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  const orderSummary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);

    // Calculate discount total
    const discountTotal = items.reduce((sum, item) => {
      const itemSubtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      return sum + itemSubtotal * (Number(item.discountPercent ?? 0) / 100);
    }, 0);

    // Calculate tax total
    const taxTotal = items.reduce((sum, item) => {
      const taxRate = masterData.taxRates.find((t) => t.id === item.taxRateId);
      const rate = taxRate?.rate ?? 0;
      return sum + Number(item.lineTotal ?? 0) * (rate / 100);
    }, 0);

    const shippingCost = 0; // Will be set by shipping method selection

    const grandTotal = subtotal + taxTotal + shippingCost;

    return {
      subtotal,
      discount: discountTotal,
      tax: taxTotal,
      shipping: shippingCost,
      grandTotal,
    };
  }, [items, masterData.taxRates]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleItemsChange = useCallback((updatedItems: unknown[]) => {
    setValue('items', updatedItems as typeof items, { shouldValidate: true });
  }, [setValue]);

  const handleFormSubmit = useCallback(
    handleSubmit((data) => {
      onSubmit?.(data);
    }),
    [handleSubmit, onSubmit]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <FormProvider {...methods}>
      <form
        id="sales-order-form"
        onSubmit={handleFormSubmit}
        className="space-y-10"
      >
        {/* Section 1: Sales Order Information */}
        <SalesOrderInfoSection
          customers={masterData.customers}
          salesReps={masterData.salesReps}
          warehouses={masterData.warehouses}
          currencies={masterData.currencies}
        />

        {/* Section 2: Billing & Shipping */}
        <BillingShippingSection
          shippingMethods={masterData.shippingMethods}
          isLoadingAddresses={isLoadingAddresses}
        />

        {/* Section 3: Order Items */}
        <OrderItemsTable
          products={masterData.products}
          units={masterData.units}
          taxRates={masterData.taxRates}
          items={items}
          onItemsChange={handleItemsChange}
          onProductSelect={handleProductSelect}
        />

        {/* Section 4: Order Summary */}
        <OrderSummaryCards
          subtotal={orderSummary.subtotal}
          discount={orderSummary.discount}
          tax={orderSummary.tax}
          shipping={orderSummary.shipping}
          grandTotal={orderSummary.grandTotal}
          currencySymbol="$"
        />

        {/* Section 5: Notes */}
        <NotesSection />
      </form>
    </FormProvider>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const subtotal = quantity * unitPrice;
  const discount = subtotal * (discountPercent / 100);
  return subtotal - discount;
}

// Export memoized component
export const SalesOrderForm = memo(SalesOrderFormComponent);
