#!/usr/bin/env node
/**
 * COMPLETE VERIFICATION: Excel vs Database
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

async function verifyAll() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      COMPLETE VERIFICATION: Excel vs Database             ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ==================== SALES ORDERS ====================
  console.log('📊 SALES ORDERS:\n');

  const { data: allSOs } = await supabase
    .from('sales_orders')
    .select('order_number')
    .gte('order_number', 'SO2600000')
    .lte('order_number', 'SO2600100')
    .is('deleted_at', null)
    .order('order_number');

  console.log('All Sales Orders in Database:');
  console.log('First SO: ' + (allSOs?.[0]?.order_number || 'none'));
  console.log('Last SO:  ' + (allSOs?.[allSOs.length - 1]?.order_number || 'none'));
  console.log('Total:    ' + (allSOs?.length || 0) + ' sales orders\n');

  // Show first 10
  console.log('First 10 Sales Orders:');
  allSOs?.slice(0, 10).forEach((so, idx) => {
    console.log('  ' + (idx + 1) + '. ' + so.order_number);
  });
  console.log('');

  // Expected from Excel: SO2600023 to SO2600036 (14 rows in GDC 0)
  console.log('EXCEL EXPECTATION (GDC 0):');
  console.log('  Should start from: SO2600023');
  console.log('  Should end at:     SO2600036 (14 orders)\n');

  const { data: gdcSOs } = await supabase
    .from('sales_orders')
    .select('order_number, customer_po_number, customers!inner(name)')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  console.log('GDC Range (SO2600023-053) in Database:');
  console.log('  Count: ' + (gdcSOs?.length || 0) + ' orders\n');

  // ==================== PURCHASE ORDERS ====================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📦 PURCHASE ORDERS:\n');

  const { data: allPOs } = await supabase
    .from('purchase_orders')
    .select('po_number, sales_order_id')
    .is('deleted_at', null)
    .order('po_number');

  console.log('All Purchase Orders in Database:');
  console.log('Total: ' + (allPOs?.length || 0) + ' POs\n');

  if (allPOs && allPOs.length > 0) {
    console.log('First 20 Purchase Orders:');
    allPOs.slice(0, 20).forEach((po, idx) => {
      console.log('  ' + (idx + 1) + '. ' + po.po_number);
    });
    console.log('');
  }

  // ==================== COMPARISON ====================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 EXCEL vs DATABASE COMPARISON:\n');

  console.log('SO Number  | Excel PO (Column G)      | Database PO          | Match?');
  console.log('─'.repeat(80));

  const soToPOMap = new Map();
  allPOs?.forEach(po => {
    soToPOMap.set(po.sales_order_id, po.po_number);
  });

  let matchCount = 0;
  let mismatchCount = 0;

  for (const so of gdcSOs || []) {
    const excelPO = so.customer_po_number || '(none)';
    const dbPO = soToPOMap.get(so.id) || '(none)';

    // Skip quotes
    if (excelPO.startsWith('Q')) {
      continue;
    }

    const match = excelPO === dbPO ? '✓' : '✗';
    if (match === '✓') matchCount++;
    else mismatchCount++;

    const matchSymbol = match === '✓' ? '✅' : '❌';
    console.log(`${so.order_number}   | ${excelPO.padEnd(24)} | ${dbPO.padEnd(20)} | ${matchSymbol}`);
  }

  console.log('─'.repeat(80));
  console.log('\nRESULTS:');
  console.log('  Matches:    ' + matchCount);
  console.log('  Mismatches: ' + mismatchCount);

  // ==================== ISSUES FOUND ====================
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔍 ISSUES FOUND:\n');

  let issueCount = 0;

  // Issue 1: Check if SO starts from 22 instead of 23
  if (allSOs && allSOs.length > 0 && allSOs[0].order_number < 'SO2600023') {
    issueCount++;
    console.log('❌ Issue ' + issueCount + ': Sales Orders start from ' + allSOs[0].order_number);
    console.log('   Expected: SO2600023 (from Excel GDC 0, row 4)\n');
  }

  // Issue 2: Check for missing orders
  const expectedOrders = [];
  for (let i = 23; i <= 53; i++) {
    expectedOrders.push('SO26000' + (i < 10 ? '0' + i : i));
  }

  const actualOrders = new Set((gdcSOs || []).map(so => so.order_number));
  const missingOrders = expectedOrders.filter(so => !actualOrders.has(so));

  if (missingOrders.length > 0) {
    issueCount++;
    console.log('❌ Issue ' + issueCount + ': Missing ' + missingOrders.length + ' sales orders:');
    missingOrders.slice(0, 5).forEach(so => console.log('   - ' + so));
    if (missingOrders.length > 5) console.log('   ... and ' + (missingOrders.length - 5) + ' more');
    console.log('');
  }

  // Issue 3: Duplicate PO numbers
  const poCounts = new Map();
  allPOs?.forEach(po => {
    poCounts.set(po.po_number, (poCounts.get(po.po_number) || 0) + 1);
  });

  const duplicatePOs = Array.from(poCounts.entries()).filter(([po, count]) => count > 1);
  if (duplicatePOs.length > 0) {
    issueCount++;
    console.log('❌ Issue ' + issueCount + ': Duplicate PO numbers in database:');
    duplicatePOs.forEach(([po, count]) => {
      console.log('   - ' + po + ' (appears ' + count + ' times)');
    });
    console.log('');
  }

  // Issue 4: PO numbers mismatch
  if (mismatchCount > 0) {
    issueCount++;
    console.log('❌ Issue ' + issueCount + ': ' + mismatchCount + ' PO numbers mismatch between Excel and Database\n');
  }

  if (issueCount === 0) {
    console.log('✅ NO ISSUES FOUND! Excel and Database are in sync! 🎉\n');
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Total Issues Found: ' + issueCount + '\n');
  }
}

verifyAll().catch(console.error);
