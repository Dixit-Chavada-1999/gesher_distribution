#!/usr/bin/env node
/**
 * Remove Duplicate Items (keep oldest)
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

const affectedOrders = [
  'SO2600024', 'SO2600025', 'SO2600026', 'SO2600027', 'SO2600028',
  'SO2600029', 'SO2600030', 'SO2600032', 'SO2600034'
];

async function removeDuplicates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   REMOVE DUPLICATE ITEMS                                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      sales_order_items (
        id,
        sku,
        quantity,
        created_at
      )
    `)
    .in('order_number', affectedOrders)
    .is('deleted_at', null);

  console.log(`Found ${salesOrders?.length || 0} orders to check\n`);

  let removed = 0;

  for (const so of salesOrders || []) {
    const items = so.sales_order_items || [];

    if (items.length === 0) {
      console.log(`${so.order_number}: No items`);
      continue;
    }

    if (items.length === 1) {
      console.log(`${so.order_number}: 1 item (OK)`);
      continue;
    }

    console.log(`${so.order_number}: ${items.length} items (DUPLICATE!)`);

    // Show all items for this order
    items.forEach(item => {
      console.log(`    - ${item.sku}: qty ${item.quantity}, created ${item.created_at}`);
    });

    // Group by SKU
    const bySKU = {};
    items.forEach(item => {
      const skuKey = item.sku || 'null';
      if (!bySKU[skuKey]) {
        bySKU[skuKey] = [];
      }
      bySKU[skuKey].push(item);
    });

    console.log(`  Grouped by SKU: ${Object.keys(bySKU).length} unique SKUs`);

    // For each SKU, keep oldest, delete rest
    for (const [sku, skuItems] of Object.entries(bySKU)) {
      if (skuItems.length > 1) {
        // Sort by created_at (oldest first)
        skuItems.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const keepItem = skuItems[0];
        const deleteItems = skuItems.slice(1);

        console.log(`  ${sku}: Keeping oldest (${keepItem.created_at}), deleting ${deleteItems.length} duplicates`);

        for (const item of deleteItems) {
          const { error } = await supabase
            .from('sales_order_items')
            .delete()
            .eq('id', item.id);

          if (error) {
            console.log(`    ❌ Error deleting: ${error.message}`);
          } else {
            console.log(`    ✅ Deleted: ${item.id}`);
            removed++;
          }
        }
      }
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   SUMMARY: ${removed} duplicate items removed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (removed > 0) {
    console.log('✅ Duplicates removed! Run verification again:\n');
    console.log('   node verify-sku-breakdown.mjs\n');
  }
}

removeDuplicates().catch(console.error);
