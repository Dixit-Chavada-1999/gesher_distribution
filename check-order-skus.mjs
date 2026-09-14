#!/usr/bin/env node
/**
 * Check which SKUs are used in orders
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function checkOrderSkus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Checking SKUs used in orders...\n');

  // Check quote items
  const { data: quoteItems } = await supabase
    .from('quote_items')
    .select('sku, quantity')
    .limit(10);

  console.log('Quote Items (sample):');
  quoteItems?.forEach(item => {
    console.log(`  ${item.sku} - Qty: ${item.quantity}`);
  });

  // Check sales order items
  const { data: soItems } = await supabase
    .from('sales_order_items')
    .select('sku, quantity')
    .limit(10);

  console.log('\nSales Order Items (sample):');
  soItems?.forEach(item => {
    console.log(`  ${item.sku} - Qty: ${item.quantity}`);
  });

  // Get unique SKUs
  const { data: uniqueQuoteSkus } = await supabase
    .from('quote_items')
    .select('sku')
    .not('sku', 'is', null);

  const { data: uniqueSoSkus } = await supabase
    .from('sales_order_items')
    .select('sku')
    .not('sku', 'is', null);

  const allSkus = new Set([
    ...(uniqueQuoteSkus?.map(i => i.sku) || []),
    ...(uniqueSoSkus?.map(i => i.sku) || [])
  ]);

  console.log('\n═══════════════════════════════════════');
  console.log('    SKUs USED IN ORDERS                 ');
  console.log('═══════════════════════════════════════');
  allSkus.forEach(sku => console.log(`  ${sku}`));
  console.log('═══════════════════════════════════════\n');
}

checkOrderSkus().catch(console.error);
