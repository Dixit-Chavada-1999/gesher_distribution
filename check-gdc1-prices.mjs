#!/usr/bin/env node
/**
 * Check GDC 1 order prices in detail
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function checkGDC1Prices() {
  console.log('🔍 Checking GDC 1 order prices...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all GDC 1 sales orders with items
  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      order_series,
      subtotal,
      grand_total,
      customers(name),
      sales_order_items(
        sku,
        description,
        quantity,
        unit_price,
        line_total
      )
    `)
    .eq('order_series', 'GDC 1')
    .order('order_number');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                        GDC 1 ORDERS - DETAILED PRICING                ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let totalOrders = 0;
  let totalValue = 0;

  for (const order of orders || []) {
    totalOrders++;
    const orderTotal = order.grand_total / 100;
    totalValue += orderTotal;

    console.log(`┌─ ${order.order_number} (${order.customers.name})`);
    console.log(`│  Order Total: $${orderTotal.toFixed(2)}`);
    console.log(`│`);
    console.log(`│  Items:`);

    for (const item of order.sales_order_items) {
      const qty = item.quantity;
      const unitPrice = (item.unit_price / 100).toFixed(2);
      const lineTotal = (item.line_total / 100).toFixed(2);

      console.log(`│    • ${item.sku.padEnd(20)} ${qty.toString().padStart(3)} × $${unitPrice.padStart(8)} = $${lineTotal.padStart(10)}`);
      console.log(`│      ${item.description}`);
    }

    // Verify calculation
    const calculatedTotal = order.sales_order_items.reduce((sum, item) => sum + item.line_total, 0);
    const matches = calculatedTotal === order.grand_total ? '✓' : '✗';

    console.log(`│`);
    console.log(`│  Calculated Total: $${(calculatedTotal / 100).toFixed(2)} ${matches}`);
    console.log(`└─────────────────────────────────────────────────────────────────────\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`  GDC 1 Summary: ${totalOrders} orders, Total Value: $${totalValue.toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Check for any $0 prices
  const { data: zeroPrice } = await supabase
    .from('sales_order_items')
    .select(`
      sales_orders!inner(order_number, order_series),
      sku,
      quantity,
      unit_price
    `)
    .eq('sales_orders.order_series', 'GDC 1')
    .eq('unit_price', 0);

  if (zeroPrice && zeroPrice.length > 0) {
    console.log('⚠️  WARNING: Found items with $0 price:\n');
    zeroPrice.forEach(item => {
      console.log(`  ${item.sales_orders.order_number}: ${item.sku} - Qty ${item.quantity} @ $0.00`);
    });
    console.log('');
  } else {
    console.log('✅ All items have prices assigned!\n');
  }
}

checkGDC1Prices().catch(console.error);
