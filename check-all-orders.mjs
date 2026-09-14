#!/usr/bin/env node
/**
 * Check all orders in database
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

async function checkOrders() {
  console.log('🔍 Checking all GDC orders in database...\n');

  // Get ALL orders (including deleted)
  const { data: allOrders } = await supabase
    .from('sales_orders')
    .select('order_number, order_series, deleted_at, created_at')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .order('order_number');

  console.log(`Total orders found (including deleted): ${allOrders?.length || 0}\n`);

  // Separate by status
  const active = allOrders?.filter(o => !o.deleted_at) || [];
  const deleted = allOrders?.filter(o => o.deleted_at) || [];

  console.log('ACTIVE ORDERS:');
  active.forEach(o => {
    console.log(`  ${o.order_number} - ${o.order_series || 'No series'}`);
  });

  if (deleted.length > 0) {
    console.log('\nDELETED ORDERS:');
    deleted.forEach(o => {
      console.log(`  ${o.order_number} - ${o.order_series || 'No series'} (deleted: ${o.deleted_at})`);
    });
  }

  console.log(`\nSummary:`);
  console.log(`  Active: ${active.length}`);
  console.log(`  Deleted: ${deleted.length}`);
  console.log(`  Total: ${allOrders?.length || 0}`);

  // Expected vs Actual
  console.log('\n═══════════════════════════════════════');
  console.log('Expected from Excel:');
  console.log('  GDC 0: SO2600023 - SO2600036 (14 orders)');
  console.log('  GDC 1: SO2600037 - SO2600053 (17 orders)');
  console.log('  Total: 31 orders');
  console.log('');
  console.log('Actual in Database:');

  const gdc0 = active.filter(o => o.order_series === 'GDC 0');
  const gdc1 = active.filter(o => o.order_series === 'GDC 1');

  console.log(`  GDC 0: ${gdc0.length} orders`);
  console.log(`  GDC 1: ${gdc1.length} orders`);
  console.log(`  Total: ${active.length} orders`);
  console.log('═══════════════════════════════════════\n');

  // Check for missing orders
  const expectedOrders = [];
  for (let i = 23; i <= 36; i++) {
    expectedOrders.push(`SO2600${String(i).padStart(3, '0')}`);
  }
  for (let i = 37; i <= 53; i++) {
    expectedOrders.push(`SO2600${String(i).padStart(3, '0')}`);
  }

  const actualNumbers = active.map(o => o.order_number);
  const missing = expectedOrders.filter(num => !actualNumbers.includes(num));

  if (missing.length > 0) {
    console.log('❌ MISSING ORDERS:');
    missing.forEach(num => console.log(`  ${num}`));
    console.log('');
  }
}

checkOrders().catch(console.error);
