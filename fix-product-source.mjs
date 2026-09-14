#!/usr/bin/env node
/**
 * Fix product_source field based on customer type
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

async function fixProductSource() {
  console.log('🔧 Fixing product_source based on customer type...\n');

  // Get all GDC sales orders
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customers!inner (name)')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null);

  if (!orders || orders.length === 0) {
    console.log('❌ No orders found!');
    return;
  }

  let directFixed = 0;
  let warehouseFixed = 0;

  for (const order of orders) {
    const customerName = order.customers.name;
    let productSource = null;

    // Determine product_source based on customer
    if (customerName === 'Gesher Distribution Company' ||
        customerName === 'Nebraska Warehouse' ||
        customerName === 'Kansas Warehouse') {
      // Warehouse inventory - set to "warehouse" (inventory-tracked)
      productSource = 'warehouse';
    } else {
      // Customer order - set to "direct" (direct shipment)
      productSource = 'direct';
    }

    // Update sales order
    const { error } = await supabase
      .from('sales_orders')
      .update({ product_source: productSource })
      .eq('id', order.id);

    if (error) {
      console.log('  ✗ ' + order.order_number + ': ' + error.message);
    } else {
      if (productSource === 'direct') {
        console.log('  ✓ ' + order.order_number + ' → direct (' + customerName + ')');
        directFixed++;
      } else {
        console.log('  ✓ ' + order.order_number + ' → warehouse (' + customerName + ')');
        warehouseFixed++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('Direct shipments fixed:     ' + directFixed);
  console.log('Warehouse inventory fixed:  ' + warehouseFixed);
  console.log('Total:                      ' + (directFixed + warehouseFixed));
  console.log('═══════════════════════════════════════\n');

  if (directFixed + warehouseFixed === orders.length) {
    console.log('✅ All orders fixed!\n');
    console.log('   હવે Ankur ના rules પ્રમાણે product_source set છે:');
    console.log('   ✓ Customer orders = "direct"');
    console.log('   ✓ Warehouse inventory = "warehouse"');
    console.log('   \n   Operations Dashboard માં proper tracking થશે! 🎉\n');
  }
}

fixProductSource().catch(console.error);
