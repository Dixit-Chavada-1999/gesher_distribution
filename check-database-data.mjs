#!/usr/bin/env node
/**
 * Check if data is actually in database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('🔍 Checking database data...\n');

  // Check one quote
  const { data: quote } = await supabase
    .from('quotes')
    .select('quote_number, subtotal, grand_total')
    .eq('quote_number', 'QT2600043')
    .single();

  console.log('QUOTE QT2600043:');
  console.log(`  Subtotal: ${quote?.subtotal || 0} cents = $${(quote?.subtotal || 0) / 100}`);
  console.log(`  Grand Total: ${quote?.grand_total || 0} cents = $${(quote?.grand_total || 0) / 100}`);
  console.log('');

  // Check quote items
  const { data: quoteItems } = await supabase
    .from('quote_items')
    .select('sku, quantity, unit_price, line_total')
    .eq('quote_id', (await supabase.from('quotes').select('id').eq('quote_number', 'QT2600043').single()).data?.id);

  console.log('QUOTE ITEMS:');
  quoteItems?.forEach(item => {
    console.log(`  ${item.sku}: ${item.quantity} × $${(item.unit_price || 0) / 100} = $${(item.line_total || 0) / 100}`);
  });
  console.log('');

  // Check sales order
  const { data: so } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      subtotal,
      grand_total,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code
    `)
    .eq('order_number', 'SO2600043')
    .single();

  console.log('SALES ORDER SO2600043:');
  console.log(`  Subtotal: ${so?.subtotal || 0} cents = $${(so?.subtotal || 0) / 100}`);
  console.log(`  Grand Total: ${so?.grand_total || 0} cents = $${(so?.grand_total || 0) / 100}`);
  console.log(`  Address:`);
  console.log(`    Street: ${so?.shipping_address_street || '(none)'}`);
  console.log(`    City: ${so?.shipping_address_city || '(none)'}`);
  console.log(`    State: ${so?.shipping_address_state || '(none)'}`);
  console.log(`    ZIP: ${so?.shipping_address_postal_code || '(none)'}`);
  console.log('');

  // Check SO items
  const { data: soItems } = await supabase
    .from('sales_order_items')
    .select('sku, quantity, unit_price, line_total')
    .eq('sales_order_id', (await supabase.from('sales_orders').select('id').eq('order_number', 'SO2600043').single()).data?.id);

  console.log('SALES ORDER ITEMS:');
  soItems?.forEach(item => {
    console.log(`  ${item.sku}: ${item.quantity} × $${(item.unit_price || 0) / 100} = $${(item.line_total || 0) / 100}`);
  });
  console.log('');

  // Count GDC 0 vs GDC 1
  const { count: gdc0Count } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact' })
    .eq('order_series', 'GDC 0')
    .is('deleted_at', null);

  const { count: gdc1Count } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact' })
    .eq('order_series', 'GDC 1')
    .is('deleted_at', null);

  console.log('ORDER SERIES:');
  console.log(`  GDC 0: ${gdc0Count} orders`);
  console.log(`  GDC 1: ${gdc1Count} orders`);
  console.log(`  Total: ${(gdc0Count || 0) + (gdc1Count || 0)} orders`);
}

checkData().catch(console.error);
