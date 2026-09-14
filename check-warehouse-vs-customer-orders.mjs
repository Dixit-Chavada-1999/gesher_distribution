#!/usr/bin/env node
/**
 * Check Warehouse vs Customer orders
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

async function checkWarehouseVsCustomer() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   WAREHOUSE INVENTORY vs CUSTOMER ORDERS CHECK            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all GDC sales orders with customer info
  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      order_series,
      product_source,
      customers!inner (
        name
      )
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  if (!orders || orders.length === 0) {
    console.log('❌ No orders found!');
    return;
  }

  console.log('Total Orders: ' + orders.length + '\n');

  // Categorize
  const warehouseOrders = orders.filter(o =>
    o.customers.name === 'Nebraska Warehouse' ||
    o.customers.name === 'Kansas Warehouse' ||
    o.customers.name === 'Gesher Distribution Company'
  );

  const customerOrders = orders.filter(o =>
    o.customers.name !== 'Nebraska Warehouse' &&
    o.customers.name !== 'Kansas Warehouse' &&
    o.customers.name !== 'Gesher Distribution Company'
  );

  console.log('CATEGORIZATION:');
  console.log('───────────────────────────────────────────────────────────\n');

  console.log('1️⃣  WAREHOUSE INVENTORY (Unallocated):');
  console.log('   આ orders aapana warehouse માં આવશે\n');
  warehouseOrders.forEach(o => {
    console.log('   ' + o.order_number + ' - ' + o.customers.name + ' (' + o.order_series + ')');
    console.log('     Product Source: ' + (o.product_source || 'NULL'));
  });
  console.log('\n   Total: ' + warehouseOrders.length);

  console.log('\n');
  console.log('2️⃣  CUSTOMER ORDERS (Direct Shipment):');
  console.log('   આ orders direct customer ને જશે (inventory માં નહીં)\n');
  customerOrders.forEach(o => {
    console.log('   ' + o.order_number + ' - ' + o.customers.name + ' (' + o.order_series + ')');
    console.log('     Product Source: ' + (o.product_source || 'NULL'));
  });
  console.log('\n   Total: ' + customerOrders.length);

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                ANKUR NA RULES                              ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('✅ WAREHOUSE INVENTORY:');
  console.log('   - Customer = "Nebraska Warehouse" / "Kansas Warehouse"');
  console.log('   - Unallocated inventory');
  console.log('   - Warehouse માં આવશે');
  console.log('   - Inventory-tracked products use કરવા\n');

  console.log('✅ CUSTOMER ORDERS:');
  console.log('   - Customer = Valley, Lindsay, WISH, etc.');
  console.log('   - Direct shipment (India → Customer)');
  console.log('   - Inventory માં નહીં આવે');
  console.log('   - product_source should be "direct"\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('                ISSUE CHECK                                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check if product_source is set correctly
  const directWithoutSource = customerOrders.filter(o => !o.product_source || o.product_source !== 'direct');
  const warehouseWithWrongSource = warehouseOrders.filter(o => o.product_source === 'direct');

  if (directWithoutSource.length > 0) {
    console.log('⚠️  Customer orders WITHOUT product_source="direct":');
    directWithoutSource.forEach(o => {
      console.log('   ' + o.order_number + ' - ' + o.customers.name);
      console.log('     Current: ' + (o.product_source || 'NULL'));
    });
    console.log('');
  }

  if (warehouseWithWrongSource.length > 0) {
    console.log('⚠️  Warehouse orders WITH product_source="direct":');
    warehouseWithWrongSource.forEach(o => {
      console.log('   ' + o.order_number + ' - ' + o.customers.name);
    });
    console.log('');
  }

  if (directWithoutSource.length === 0 && warehouseWithWrongSource.length === 0) {
    console.log('✅ બધા orders નો product_source correct છે!\n');
  }
}

checkWarehouseVsCustomer().catch(console.error);
