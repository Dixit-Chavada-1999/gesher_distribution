#!/usr/bin/env node
/**
 * COMPLETE FIX: Create Products + Add Missing Items
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

const missingItemsOrders = [
  'SO2600024', 'SO2600025', 'SO2600026', 'SO2600027', 'SO2600028',
  'SO2600029', 'SO2600030', 'SO2600032', 'SO2600034'
];

async function fixComplete() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   COMPLETE FIX: Create Products + Add Items               ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ============================================================================
  // STEP 1: CREATE PRODUCTS
  // ============================================================================
  console.log('STEP 1: Create Products (38" and 24" Tires)');
  console.log('─'.repeat(60));

  const productsToCreate = [
    {
      sku: '290-85R38',
      name: '290/85R38 Tire (38")',
      description: '38 inch tire',
      unit_price: 112000, // $1120 in cents
      unit_code: 'EA',
      status: 'active',
    },
    {
      sku: '380-85R24',
      name: '380/85R24 Tire (24")',
      description: '24 inch tire',
      unit_price: 108000, // $1080 in cents
      unit_code: 'EA',
      status: 'active',
    },
  ];

  let product38, product24;

  for (const productData of productsToCreate) {
    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, sku, name')
      .eq('sku', productData.sku)
      .single();

    if (existing) {
      console.log(`✅ Product exists: ${productData.sku}`);
      if (productData.sku === '290-85R38') product38 = existing;
      if (productData.sku === '380-85R24') product24 = existing;
    } else {
      // Create product
      const { data: newProduct, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.log(`❌ Error creating ${productData.sku}: ${error.message}`);
        return;
      }

      console.log(`✅ Created: ${newProduct.sku} - ${newProduct.name}`);
      if (productData.sku === '290-85R38') product38 = newProduct;
      if (productData.sku === '380-85R24') product24 = newProduct;
    }
  }

  if (!product38 || !product24) {
    console.log('❌ Failed to create products!');
    return;
  }

  console.log('');

  // ============================================================================
  // STEP 2: READ EXCEL DATA
  // ============================================================================
  const workbook = XLSX.readFile(excelPath);
  const gdc0Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 0'], { header: 1 });

  const excelData = new Map();

  for (let i = 3; i < gdc0Raw.length; i++) {
    const row = gdc0Raw[i];
    if (!row || !row[1]) continue;

    excelData.set(row[1], {
      soNumber: row[1],
      sku38Qty: row[2] || 0,
      sku24Qty: row[3] || 0,
      totalQty: row[4] || 0,
      price38: row[15] || null,
      price24: row[16] || null,
    });
  }

  // ============================================================================
  // STEP 3: GET SALES ORDERS
  // ============================================================================
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number')
    .in('order_number', missingItemsOrders)
    .is('deleted_at', null);

  console.log(`STEP 2: Fix ${salesOrders?.length || 0} Orders`);
  console.log('─'.repeat(60));
  console.log('');

  if (!salesOrders || salesOrders.length === 0) {
    console.log('❌ No orders found!');
    return;
  }

  // ============================================================================
  // STEP 4: FIX EACH ORDER
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

    // Add 38" tire item
    if (excelRow.sku38Qty > 0) {
      const price = excelRow.price38 || 1120;
      itemsToInsert.push({
        sales_order_id: so.id,
        product_id: product38.id,
        sku: product38.sku,
        description: product38.name,
        quantity: excelRow.sku38Qty,
        unit_code: 'EA',
        unit_price: Math.round(price * 100),
        discount_percent: 0,
        tax_rate: 0,
        line_total: Math.round(price * excelRow.sku38Qty * 100),
        sort_order: 0,
      });
    }

    // Add 24" tire item
    if (excelRow.sku24Qty > 0) {
      const price = excelRow.price24 || 1080;
      itemsToInsert.push({
        sales_order_id: so.id,
        product_id: product24.id,
        sku: product24.sku,
        description: product24.name,
        quantity: excelRow.sku24Qty,
        unit_code: 'EA',
        unit_price: Math.round(price * 100),
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
      console.log(`   ❌ Error: ${error.message}`);
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

  console.log(`Products Created: 2 (38" and 24" tires)`);
  console.log(`Orders Fixed:     ${fixed}/${salesOrders.length}`);
  console.log(`Orders Failed:    ${failed}`);
  console.log('');

  if (fixed === salesOrders.length) {
    console.log('✅ બધું PERFECT! બધા 9 orders fix થઈ ગયા! 🎉\n');
    console.log('   હવે verification script run કરો:\n');
    console.log('   node verify-sku-breakdown.mjs\n');
  } else {
    console.log('⚠️  Some orders failed. Check errors above.\n');
  }
}

fixComplete().catch(console.error);
