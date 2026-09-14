#!/usr/bin/env node
/**
 * Count expected orders from Excel vs Actual in Database
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

async function countOrders() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      EXPECTED vs ACTUAL ORDER COUNT                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // From Excel screenshots:
  // GDC 0: Rows 4-17 (14 rows) → SO2600023 to SO2600036
  // GDC 1: Rows 4-20 (17 rows) → SO2600037 to SO2600053

  console.log('📊 EXCEL EXPECTATION:\n');
  console.log('GDC 0 Sheet:');
  console.log('  Rows: 4-17 (14 orders)');
  console.log('  Range: SO2600023 to SO2600036\n');

  console.log('GDC 1 Sheet:');
  console.log('  Rows: Need to verify');
  console.log('  Last visible: SO2600036 (row 17 in screenshot)\n');

  // Check actual database
  const { data: allOrders } = await supabase
    .from('sales_orders')
    .select('order_number, customer_po_number')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600100')
    .is('deleted_at', null)
    .order('order_number');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📦 DATABASE ACTUAL:\n');

  console.log('Total Orders: ' + (allOrders?.length || 0));
  console.log('First: ' + (allOrders?.[0]?.order_number || 'none'));
  console.log('Last:  ' + (allOrders?.[allOrders.length - 1]?.order_number || 'none'));
  console.log('');

  // List all orders
  console.log('All Orders in Database:');
  console.log('SO Number   | Customer PO / Quote');
  console.log('─'.repeat(50));

  allOrders?.forEach((order, idx) => {
    const po = order.customer_po_number || '(none)';
    console.log((idx + 1).toString().padStart(2) + '. ' + order.order_number + '   | ' + po);
  });

  console.log('');

  // Expected range check
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 MISSING ORDERS CHECK:\n');

  const expectedStart = 23;
  const expectedEnd = 53; // Based on user saying data goes to SO2600053

  const expected = [];
  for (let i = expectedStart; i <= expectedEnd; i++) {
    const num = i < 10 ? '0' + i : i.toString();
    expected.push('SO26000' + num);
  }

  const actual = new Set(allOrders?.map(o => o.order_number) || []);
  const missing = expected.filter(so => !actual.has(so));

  if (missing.length > 0) {
    console.log('❌ MISSING ' + missing.length + ' ORDERS:\n');
    missing.forEach(so => console.log('  - ' + so));
  } else {
    console.log('✅ All expected orders present (SO2600023 to SO2600053)');
  }

  console.log('\n');

  // PO vs Quote breakdown
  const withPO = allOrders?.filter(o => o.customer_po_number && !o.customer_po_number.startsWith('Q')) || [];
  const withQuote = allOrders?.filter(o => o.customer_po_number && o.customer_po_number.startsWith('Q')) || [];
  const withNone = allOrders?.filter(o => !o.customer_po_number) || [];

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 BREAKDOWN:\n');
  console.log('Orders with PO numbers:    ' + withPO.length);
  console.log('Orders with Quote numbers: ' + withQuote.length);
  console.log('Orders with no PO/Quote:   ' + withNone.length);
  console.log('Total:                     ' + (allOrders?.length || 0));
  console.log('');

  console.log('EXPECTED TOTAL (if SO2600023 to SO2600053): ' + expected.length + ' orders');
  console.log('ACTUAL TOTAL:                                ' + (allOrders?.length || 0) + ' orders');
  console.log('');

  if (expected.length !== allOrders?.length) {
    console.log('❌ COUNT MISMATCH: Missing ' + (expected.length - (allOrders?.length || 0)) + ' orders\n');
  } else {
    console.log('✅ COUNT MATCHES! 🎉\n');
  }
}

countOrders().catch(console.error);
