#!/usr/bin/env node
/**
 * Check what SKUs are in sales_order_items
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

async function checkOrderItemsSKUs() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   SKUs IN SALES_ORDER_ITEMS                               ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: items } = await supabase
    .from('sales_order_items')
    .select('sku, product_name, quantity, unit_price, sales_orders(order_number)')
    .is('deleted_at', null)
    .limit(50);

  console.log(`Found ${items?.length || 0} items\n`);

  if (items && items.length > 0) {
    console.log('SO Number   | SKU          | Product Name              | Qty | Price');
    console.log('─'.repeat(85));

    items.forEach(item => {
      const soNumber = item.sales_orders?.order_number || '(no SO)';
      const sku = item.sku || '(no sku)';
      const name = item.product_name || '(no name)';
      const qty = item.quantity || 0;
      const price = item.unit_price ? `$${item.unit_price / 100}` : '(no price)';

      console.log(
        soNumber.padEnd(11) + ' | ' +
        sku.padEnd(12) + ' | ' +
        name.substring(0, 25).padEnd(25) + ' | ' +
        String(qty).padEnd(3) + ' | ' +
        price
      );
    });

    console.log('─'.repeat(85));
    console.log('');

    // Get unique SKUs
    const uniqueSKUs = [...new Set(items.map(i => i.sku).filter(Boolean))];
    console.log('Unique SKUs:');
    uniqueSKUs.forEach(sku => {
      const count = items.filter(i => i.sku === sku).length;
      console.log(`  - ${sku} (used in ${count} items)`);
    });
    console.log('');
  } else {
    console.log('❌ No items found!\n');
  }
}

checkOrderItemsSKUs().catch(console.error);
