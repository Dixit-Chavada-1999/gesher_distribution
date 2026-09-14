#!/usr/bin/env node
/**
 * Check what PO numbers are in Excel Column G
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

async function checkPONumbers() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      CHECK EXCEL PO COLUMN (customer_po_number)           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all GDC sales orders with customer PO numbers
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('order_number, customer_po_number')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  if (!orders || orders.length === 0) {
    console.log('❌ No orders found!');
    return;
  }

  console.log('Found ' + orders.length + ' orders\n');
  console.log('SO Number       | Customer PO (from Excel Column G)');
  console.log('─'.repeat(60));

  orders.forEach(order => {
    const po = order.customer_po_number || '(null)';
    console.log(order.order_number + '   | ' + po);
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ANALYSIS:');
  console.log('═══════════════════════════════════════════════════════════\n');

  const withPO = orders.filter(o => o.customer_po_number).length;
  const withoutPO = orders.filter(o => !o.customer_po_number).length;

  console.log('Orders with PO number: ' + withPO);
  console.log('Orders without PO:     ' + withoutPO);

  // Check if these look like purchase orders to Galileo
  console.log('\nPO Number Formats:');
  const poFormats = new Set();
  orders.forEach(order => {
    if (order.customer_po_number) {
      if (order.customer_po_number.startsWith('PO-')) {
        poFormats.add('PO-xxxxx (Purchase Order format)');
      } else if (order.customer_po_number.startsWith('Q')) {
        poFormats.add('Qxxxxx (Quote format)');
      } else if (order.customer_po_number.startsWith('PO')) {
        poFormats.add('POxxxxxx (PO without dash)');
      } else {
        poFormats.add('Other: ' + order.customer_po_number);
      }
    }
  });

  poFormats.forEach(format => console.log('  - ' + format));

  console.log('\n');
}

checkPONumbers().catch(console.error);
