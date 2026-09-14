#!/usr/bin/env node
/**
 * Verify SKU Breakdown: Database vs Excel
 * Check if 38" and 24" tire quantities match
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import XLSX from 'xlsx';
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

const excelPath = path.resolve('D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx');

async function verifySkuBreakdown() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   SKU BREAKDOWN VERIFICATION (Database vs Excel)          ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ============================================================================
  // READ EXCEL DATA
  // ============================================================================
  const workbook = XLSX.readFile(excelPath);
  const gdc0Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 0'], { header: 1 });
  const gdc1Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 1'], { header: 1 });

  const excelData = new Map();

  // Parse GDC 0
  for (let i = 3; i < gdc0Raw.length; i++) {
    const row = gdc0Raw[i];
    if (!row || !row[1]) continue;

    excelData.set(row[1], {
      soNumber: row[1],
      sku38Qty: row[2] || 0,
      sku24Qty: row[3] || 0,
      totalQty: row[4] || 0,
      po: row[6],
      series: 'GDC 0',
    });
  }

  // Parse GDC 1
  for (let i = 3; i < gdc1Raw.length; i++) {
    const row = gdc1Raw[i];
    if (!row || !row[1]) continue;

    excelData.set(row[1], {
      soNumber: row[1],
      sku38Qty: row[2] || 0,
      sku24Qty: row[3] || 0,
      totalQty: row[4] || 0,
      po: row[6],
      series: 'GDC 1',
    });
  }

  console.log(`Excel: Found ${excelData.size} orders\n`);

  // ============================================================================
  // READ DATABASE DATA
  // ============================================================================
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      customer_po_number,
      order_series,
      sales_order_items (
        id,
        product_id,
        sku,
        quantity,
        products (
          name
        )
      )
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  console.log(`Database: Found ${salesOrders?.length || 0} orders\n`);

  // ============================================================================
  // COMPARE
  // ============================================================================
  console.log('COMPARISON: Excel vs Database SKU Breakdown');
  console.log('─'.repeat(100));
  console.log('SO Number   | Excel (38"/24") | DB (38"/24")    | Total | Match?');
  console.log('─'.repeat(100));

  let matches = 0;
  let mismatches = 0;
  const issues = [];

  for (const so of salesOrders || []) {
    const excelRow = excelData.get(so.order_number);
    if (!excelRow) {
      issues.push(`${so.order_number}: Not found in Excel`);
      continue;
    }

    // Calculate DB quantities from items
    let db38Qty = 0;
    let db24Qty = 0;
    let dbTotalQty = 0;

    so.sales_order_items?.forEach(item => {
      const sku = item.sku || '';
      const qty = item.quantity || 0;

      // Match both formats: 290/85R38 and 290-85R38
      if (sku.includes('290') && (sku.includes('85') || sku.includes('38'))) {
        db38Qty += qty;
        dbTotalQty += qty; // Only count tire items
      } else if (sku.includes('380') && (sku.includes('85') || sku.includes('24'))) {
        db24Qty += qty;
        dbTotalQty += qty; // Only count tire items
      }
      // Skip service items (COMMISSION-SERVICE, etc.) from total count
    });

    const excel38 = excelRow.sku38Qty;
    const excel24 = excelRow.sku24Qty;
    const excelTotal = excelRow.totalQty;

    const match38 = db38Qty === excel38;
    const match24 = db24Qty === excel24;
    const matchTotal = dbTotalQty === excelTotal;
    const allMatch = match38 && match24 && matchTotal;

    if (allMatch) {
      matches++;
    } else {
      mismatches++;
      issues.push(
        `${so.order_number}: Excel (${excel38}×38" + ${excel24}×24" = ${excelTotal}), ` +
        `DB (${db38Qty}×38" + ${db24Qty}×24" = ${dbTotalQty})`
      );
    }

    const status = allMatch ? '✅' : '❌';

    console.log(
      so.order_number.padEnd(11) + ' | ' +
      `${excel38}×38" + ${excel24}×24"`.padEnd(15) + ' | ' +
      `${db38Qty}×38" + ${db24Qty}×24"`.padEnd(15) + ' | ' +
      `${excelTotal}/${dbTotalQty}`.padEnd(5) + ' | ' +
      status
    );
  }

  console.log('─'.repeat(100));
  console.log('');

  console.log('SUMMARY:');
  console.log(`  Matches:    ${matches}/${salesOrders?.length || 0}`);
  console.log(`  Mismatches: ${mismatches}`);
  console.log(`  Status:     ${mismatches === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:');
    issues.forEach(issue => console.log('   ' + issue));
    console.log('');
  }

  // ============================================================================
  // DETAILED BREAKDOWN (78 and 96 qty orders)
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DETAILED: 78 and 96 Qty Orders                          ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const specialQtyOrders = salesOrders?.filter(so => {
    const excelRow = excelData.get(so.order_number);
    return excelRow && (excelRow.totalQty === 78 || excelRow.totalQty === 96);
  });

  if (specialQtyOrders && specialQtyOrders.length > 0) {
    for (const so of specialQtyOrders) {
      const excelRow = excelData.get(so.order_number);

      console.log(`${so.order_number} (Customer PO: ${so.customer_po_number})`);
      console.log(`  Excel Expected: ${excelRow.sku38Qty}×38" + ${excelRow.sku24Qty}×24" = ${excelRow.totalQty}`);
      console.log(`  Database Items:`);

      if (so.sales_order_items && so.sales_order_items.length > 0) {
        so.sales_order_items.forEach(item => {
          console.log(`    - ${item.sku}: ${item.quantity} qty`);
        });
      } else {
        console.log(`    ❌ No items found!`);
      }
      console.log('');
    }
  } else {
    console.log('No orders with 78 or 96 qty found in database.\n');
  }

  // ============================================================================
  // RECOMMENDATION
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   RECOMMENDATION                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (mismatches === 0) {
    console.log('✅ Database SKU breakdown matches Excel perfectly!');
    console.log('   No changes needed.\n');
  } else {
    console.log('❌ Database SKU breakdown does NOT match Excel!');
    console.log('');
    console.log('ACTION NEEDED:');
    console.log('  1. Fix data ingestion script to properly split SKU quantities');
    console.log('  2. Update sales_order_items table with correct 38" and 24" quantities');
    console.log('  3. Re-verify after fixing');
    console.log('');
  }
}

verifySkuBreakdown().catch(console.error);
