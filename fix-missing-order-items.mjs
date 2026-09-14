#!/usr/bin/env node
/**
 * Fix Missing Order Items
 * Add sales_order_items for 9 orders that are missing line items
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

// Orders that need fixing
const missingItemsOrders = [
  'SO2600024', 'SO2600025', 'SO2600026', 'SO2600027', 'SO2600028',
  'SO2600029', 'SO2600030', 'SO2600032', 'SO2600034'
];

async function fixMissingOrderItems() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   FIX MISSING ORDER ITEMS (9 Orders)                      ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ============================================================================
  // READ EXCEL DATA
  // ============================================================================
  const workbook = XLSX.readFile(excelPath);
  const gdc0Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 0'], { header: 1 });

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
      price38: row[15] || null,  // Column P: 38" Price
      price24: row[16] || null,  // Column Q: 24" Price
      po: row[6],
    });
  }

  // ============================================================================
  // PRODUCT INFO (Direct SKU, no product_id required)
  // ============================================================================
  console.log('Product SKUs to use:');
  console.log(`  38" Tire: 290-85R38`);
  console.log(`  24" Tire: 380-85R24`);
  console.log('');

  // ============================================================================
  // GET SALES ORDERS
  // ============================================================================
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, grand_total')
    .in('order_number', missingItemsOrders)
    .is('deleted_at', null);

  console.log(`Found ${salesOrders?.length || 0} orders to fix:\n`);

  if (!salesOrders || salesOrders.length === 0) {
    console.log('❌ No orders found!');
    return;
  }

  // ============================================================================
  // FIX EACH ORDER
  // ============================================================================
  let fixed = 0;
  let failed = 0;

  for (const so of salesOrders) {
    const excelRow = excelData.get(so.order_number);
    if (!excelRow) {
      console.log(`❌ ${so.order_number}: Not found in Excel`);
      failed++;
      continue;
    }

    console.log(`📦 ${so.order_number}`);
    console.log(`   Excel: ${excelRow.sku38Qty}×38" + ${excelRow.sku24Qty}×24" = ${excelRow.totalQty}`);

    const itemsToInsert = [];

    // Add 38" tire item if needed
    if (excelRow.sku38Qty > 0) {
      const price = excelRow.price38 || 1120; // Default $1120
      itemsToInsert.push({
        sales_order_id: so.id,
        product_id: null,
        sku: '290-85R38',
        description: '290/85R38 Tire (38")',
        quantity: excelRow.sku38Qty,
        unit_code: 'EA',
        unit_price: Math.round(price * 100), // Convert to cents
        discount_percent: 0,
        tax_rate: 0,
        line_total: Math.round(price * excelRow.sku38Qty * 100),
        sort_order: 0,
      });
    }

    // Add 24" tire item if needed
    if (excelRow.sku24Qty > 0) {
      const price = excelRow.price24 || 1080; // Default $1080
      itemsToInsert.push({
        sales_order_id: so.id,
        product_id: null,
        sku: '380-85R24',
        description: '380/85R24 Tire (24")',
        quantity: excelRow.sku24Qty,
        unit_code: 'EA',
        unit_price: Math.round(price * 100), // Convert to cents
        discount_percent: 0,
        tax_rate: 0,
        line_total: Math.round(price * excelRow.sku24Qty * 100),
        sort_order: 1,
      });
    }

    if (itemsToInsert.length === 0) {
      console.log(`   ⚠️  No items to add!`);
      failed++;
      continue;
    }

    // Insert items
    const { data: insertedItems, error } = await supabase
      .from('sales_order_items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.log(`   ❌ Error inserting items: ${error.message}`);
      failed++;
      continue;
    }

    console.log(`   ✅ Added ${insertedItems.length} item(s):`);
    insertedItems.forEach(item => {
      console.log(`      - ${item.sku}: ${item.quantity} × $${item.unit_price / 100}`);
    });

    fixed++;
    console.log('');
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   SUMMARY                                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Orders: ${salesOrders.length}`);
  console.log(`Fixed:        ${fixed}`);
  console.log(`Failed:       ${failed}`);
  console.log('');

  if (fixed === salesOrders.length) {
    console.log('✅ બધા 9 orders fix થઈ ગયા! 🎉\n');
    console.log('   Now run verify script again to confirm.\n');
  } else {
    console.log('⚠️  Some orders could not be fixed. Check errors above.\n');
  }
}

fixMissingOrderItems().catch(console.error);
