#!/usr/bin/env node
/**
 * Fix prices for products, quotes, and sales orders
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function fixPrices() {
  console.log('💰 Fixing product prices and order totals...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Prices from PDFs (in cents)
  const PRICES = {
    '290-85R38': 110000, // $1,100.00 (average price from PDFs)
    '380-85R24': 110000, // $1,100.00 (from Lindsay PO)
    'COMMISSION-SERVICE': 27500, // $275.00 (commission per tire)
  };

  console.log('Step 1: Updating product prices...');

  for (const [sku, price] of Object.entries(PRICES)) {
    const cost = sku === 'COMMISSION-SERVICE' ? 0 : 80000; // $800 cost from Excel

    const { error } = await supabase
      .from('products')
      .update({
        base_price: price,
        base_cost: cost
      })
      .eq('sku', sku);

    if (error) {
      console.log(`  ❌ Error updating ${sku}: ${error.message}`);
    } else {
      console.log(`  ✓ Updated ${sku} = $${(price / 100).toFixed(2)} (cost: $${(cost / 100).toFixed(2)})`);
    }
  }

  console.log('\nStep 2: Updating quote items with prices...');

  // Get all quote items
  const { data: quoteItems } = await supabase
    .from('quote_items')
    .select('id, sku, quantity');

  let quoteItemsUpdated = 0;
  for (const item of quoteItems || []) {
    const price = PRICES[item.sku];
    if (price) {
      const lineTotal = price * item.quantity;

      const { error } = await supabase
        .from('quote_items')
        .update({
          unit_price: price,
          line_total: lineTotal
        })
        .eq('id', item.id);

      if (!error) quoteItemsUpdated++;
    }
  }
  console.log(`  ✓ Updated ${quoteItemsUpdated} quote items`);

  console.log('\nStep 3: Updating sales order items with prices...');

  // Get all sales order items
  const { data: soItems } = await supabase
    .from('sales_order_items')
    .select('id, sku, quantity');

  let soItemsUpdated = 0;
  for (const item of soItems || []) {
    const price = PRICES[item.sku];
    if (price) {
      const lineTotal = price * item.quantity;

      const { error } = await supabase
        .from('sales_order_items')
        .update({
          unit_price: price,
          line_total: lineTotal
        })
        .eq('id', item.id);

      if (!error) soItemsUpdated++;
    }
  }
  console.log(`  ✓ Updated ${soItemsUpdated} sales order items`);

  console.log('\nStep 4: Recalculating quote totals...');

  // Get all quotes
  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      id,
      quote_items(unit_price, quantity)
    `);

  let quotesUpdated = 0;
  for (const quote of quotes || []) {
    const subtotal = quote.quote_items.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);

    const { error } = await supabase
      .from('quotes')
      .update({
        subtotal,
        tax_total: 0,
        grand_total: subtotal
      })
      .eq('id', quote.id);

    if (!error) quotesUpdated++;
  }
  console.log(`  ✓ Recalculated ${quotesUpdated} quotes`);

  console.log('\nStep 5: Recalculating sales order totals...');

  // Get all sales orders
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      sales_order_items(unit_price, quantity)
    `);

  let soUpdated = 0;
  for (const so of salesOrders || []) {
    const subtotal = so.sales_order_items.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);

    const { error } = await supabase
      .from('sales_orders')
      .update({
        subtotal,
        tax_total: 0,
        grand_total: subtotal
      })
      .eq('id', so.id);

    if (!error) soUpdated++;
  }
  console.log(`  ✓ Recalculated ${soUpdated} sales orders`);

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log(`Products updated:        3`);
  console.log(`Quote items updated:     ${quoteItemsUpdated}`);
  console.log(`SO items updated:        ${soItemsUpdated}`);
  console.log(`Quotes recalculated:     ${quotesUpdated}`);
  console.log(`Sales orders recalc:     ${soUpdated}`);
  console.log('═══════════════════════════════════════');
  console.log('\n✅ Price fixes complete!\n');
}

fixPrices().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
