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

import { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { SalesOrderInfoSection } from './SalesOrderInfoSection';
import { BillingShippingSection } from './BillingShippingSection';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderSummaryCards } from './OrderSummaryCards';
import { NotesSection } from './NotesSection';
import { CreditWarning } from '@/shared/components/ui/credit-warning';

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
  orderSeries: '',
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
  const watchedItems = watch('items');

  // Ensure items have required fields with correct types for OrderItemsTable
  const items = (watchedItems || []).map(item => ({
    ...item,
    description: item.description || '',
    quantity: Number(item.quantity) || 0,
    unitId: item.unitId || 'EA',
    unitPrice: Number(item.unitPrice) || 0,
    discountPercent: Number(item.discountPercent) || 0,
    taxRateId: item.taxRateId || '',
    lineTotal: Number(item.lineTotal) || 0,
  }));

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [_isCreditOverridden, setIsCreditOverridden] = useState(false);

  // Track if this is the initial load (for edit mode)
  // Skip price updates on initial load to preserve existing prices
  const isInitialLoad = useRef(!!initialData);
  const previousCustomerId = useRef(customerId);

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

  // Effect to auto-fill addresses and update product prices when customer changes
  useEffect(() => {
    if (customerId) {
      // Check if this is initial load OR customer hasn't actually changed
      const customerChanged = previousCustomerId.current !== customerId;
      previousCustomerId.current = customerId;

      // Only fill addresses on initial load or when customer changes
      if (isInitialLoad.current || customerChanged) {
        handleCustomerChange(customerId);
      }

      // Reset credit override when customer changes
      if (customerChanged) {
        setIsCreditOverridden(false);
      }

      // Skip price updates on initial load (preserve existing prices when editing)
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      // Only re-fetch prices when customer actually changes (not on initial load)
      if (!customerChanged) {
        return;
      }

      // Re-fetch prices for existing items based on new customer's channel
      const updateItemPrices = async () => {
        const currentItems = methods.getValues('items');
        if (currentItems && currentItems.length > 0) {
          const updatedItems = await Promise.all(
            currentItems.map(async (item) => {
              if (!item.productId) { return item; }

              // Find the product to check its item type
              const product = masterData.products.find(p => p.id === item.productId);

              // Skip price updates for service/non_inventory items that already have a price
              // These items typically have manually entered prices that shouldn't be overwritten
              if (product && (product.itemType === 'service' || product.itemType === 'non_inventory')) {
                const currentPrice = Number(item.unitPrice) || 0;
                if (currentPrice > 0) {
                  // Keep the existing manually-entered price
                  return item;
                }
              }

              try {
                const result = await getProductPrice(item.productId, customerId, Number(item.quantity) || 1);
                if (result.success && result.data) {
                  const unitPrice = result.data.unitPrice / 100;
                  const discountPercent = Number(item.discountPercent) || 0;
                  const quantity = Number(item.quantity) || 1;
                  const lineTotal = quantity * unitPrice * (1 - discountPercent / 100);

                  return {
                    ...item,
                    unitPrice,
                    lineTotal,
                  };
                }
              } catch (error) {
                console.error('Failed to update price for product:', item.productId, error);
              }
              return item;
            })
          );
          // Don't validate here - only validate on submit
          setValue('items', updatedItems);
        }
      };
      updateItemPrices();
    }
  }, [customerId, handleCustomerChange, methods, setValue, masterData.products]);

  // Credit check handlers
  const handleCreditOverridden = useCallback(() => {
    setIsCreditOverridden(true);
  }, []);

  // ----------------------------------------
  // AUTO-FILL: Product Price (uses price matrix based on customer channel)
  // ----------------------------------------

  const handleProductSelect = useCallback(async (
    itemIndex: number,
    productId: string
  ) => {
    if (!productId) { return; }

    try {
      const currentItems = methods.getValues('items');
      const currentItem = currentItems[itemIndex];
      const quantity = Number(currentItem?.quantity ?? 1);

      // Pass customerId for price matrix lookup
      const result = await getProductPrice(productId, customerId || undefined, quantity);

      if (result.success && result.data) {
        const updatedItems = [...currentItems];
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
        setValue('items', updatedItems, { shouldValidate: true });
      }
    } catch (error) {
      console.error('Failed to fetch product price:', error);
    }
  }, [methods, setValue, customerId]);

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  const orderSummary = useMemo(() => {
    // Calculate pre-tax subtotal (qty × price - discount, before tax)
    const subtotal = items.reduce((sum, item) => {
      const itemSubtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      const discountAmount = itemSubtotal * (Number(item.discountPercent ?? 0) / 100);
      return sum + (itemSubtotal - discountAmount);
    }, 0);

    // Calculate discount total
    const discountTotal = items.reduce((sum, item) => {
      const itemSubtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      return sum + itemSubtotal * (Number(item.discountPercent ?? 0) / 100);
    }, 0);

    // Calculate tax total
    const taxTotal = items.reduce((sum, item) => {
      const taxRate = masterData.taxRates.find((t) => t.id === item.taxRateId);
      const rate = taxRate?.rate ?? 0;
      const itemSubtotal = Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0);
      const discountAmount = itemSubtotal * (Number(item.discountPercent ?? 0) / 100);
      const subtotalAfterDiscount = itemSubtotal - discountAmount;
      return sum + subtotalAfterDiscount * (rate / 100);
    }, 0);

    const shippingCost = 0; // Will be set by shipping method selection

    // Grand total = subtotal + tax (lineTotal already includes tax, so we use subtotal + tax)
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

        {/* Section 4: Order Summary with Credit Check */}
        <OrderSummaryCards
          subtotal={orderSummary.subtotal}
          discount={orderSummary.discount}
          tax={orderSummary.tax}
          shipping={orderSummary.shipping}
          grandTotal={orderSummary.grandTotal}
          currencySymbol="$"
          creditSlot={
            customerId ? (
              <CreditWarning
                customerId={customerId}
                orderTotal={orderSummary.grandTotal}
                onCreditOverridden={handleCreditOverridden}
              />
            ) : undefined
          }
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
