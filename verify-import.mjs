import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifyImport() {
  console.log('=== DATA IMPORT VERIFICATION ===\n');

  try {
    // Read parsed JSON
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));
    const allOrders = [...jsonData.gdc0, ...jsonData.gdc1];

    console.log(`📊 Expected orders from Excel: ${allOrders.length}\n`);

    // Get all sales orders
    const { data: salesOrders, error: soError } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_id,
        customer_po_number,
        status,
        order_date,
        requested_delivery_date,
        internal_notes,
        sales_order_items (
          id,
          product_id,
          quantity,
          unit_price,
          sku
        )
      `)
      .order('order_number', { ascending: true });

    if (soError) {
      console.error('❌ Error fetching sales orders:', soError);
      return;
    }

    console.log(`📋 Actual orders in database: ${salesOrders.length}\n`);

    // Verification checks
    let allMatch = true;
    let totalItems = 0;

    console.log('=== DETAILED VERIFICATION ===\n');

    for (const order of salesOrders) {
      const excelOrder = allOrders.find(o => o['Load #'] === order.order_number);

      if (!excelOrder) {
        console.log(`❌ Order ${order.order_number} not found in Excel data`);
        allMatch = false;
        continue;
      }

      const itemCount = order.sales_order_items?.length || 0;
      totalItems += itemCount;

      const qty38 = excelOrder['SKU 290/85R38 CW Qty'] || 0;
      const qty24 = excelOrder['SKU 380/85R24 CW Qty'] || 0;
      const expectedItems = (qty38 > 0 ? 1 : 0) + (qty24 > 0 ? 1 : 0);

      if (itemCount !== expectedItems) {
        console.log(`⚠️  ${order.order_number}: Expected ${expectedItems} items, found ${itemCount}`);
        allMatch = false;
      } else {
        console.log(`✅ ${order.order_number}: ${itemCount} items - OK`);
      }
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total Orders in Excel: ${allOrders.length}`);
    console.log(`Total Orders in DB: ${salesOrders.length}`);
    console.log(`Total Order Items: ${totalItems}`);
    console.log(`Match Status: ${allMatch ? '✅ All orders match!' : '❌ Some discrepancies found'}`);

    // Customer breakdown
    console.log('\n=== CUSTOMER BREAKDOWN ===');
    const customerCounts = {};
    for (const order of allOrders) {
      customerCounts[order.Customer] = (customerCounts[order.Customer] || 0) + 1;
    }
    for (const [customer, count] of Object.entries(customerCounts)) {
      console.log(`  ${customer}: ${count} orders`);
    }

    // Status breakdown
    console.log('\n=== STATUS BREAKDOWN ===');
    const statusCounts = {};
    for (const order of salesOrders) {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    }
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count} orders`);
    }

    console.log('\n✅ VERIFICATION COMPLETE');

  } catch (error) {
    console.error('\n❌ Fatal error during verification:', error);
  }
}

// Run verification
verifyImport();
