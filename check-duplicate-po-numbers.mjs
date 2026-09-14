#!/usr/bin/env node
/**
 * Check duplicate PO numbers in Excel data
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

async function checkDuplicates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      DUPLICATE PO NUMBERS IN EXCEL                        ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: orders } = await supabase
    .from('sales_orders')
    .select('order_number, customer_po_number, customers!inner(name)')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('customer_po_number');

  // Group by PO number
  const poMap = new Map();
  orders?.forEach(order => {
    const po = order.customer_po_number;
    if (po && !po.startsWith('Q')) {
      if (!poMap.has(po)) {
        poMap.set(po, []);
      }
      poMap.get(po).push(order);
    }
  });

  console.log('DUPLICATE PO NUMBERS:\n');
  let duplicateCount = 0;

  poMap.forEach((orders, poNumber) => {
    if (orders.length > 1) {
      duplicateCount++;
      console.log('PO Number: ' + poNumber + ' (' + orders.length + ' sales orders)');
      orders.forEach(order => {
        console.log('  - ' + order.order_number + ' → ' + order.customers.name);
      });
      console.log('');
    }
  });

  if (duplicateCount === 0) {
    console.log('✓ No duplicate PO numbers found\n');
  } else {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Found ' + duplicateCount + ' PO numbers used by multiple SOs\n');
    console.log('OPTIONS:\n');
    console.log('1. Make PO number NOT unique → Allow same PO for multiple SOs');
    console.log('   (Not recommended - violates data integrity)\n');
    console.log('2. Add suffix to duplicate POs → PO-N145710-1, PO-N145710-2');
    console.log('   (Changes Excel data)\n');
    console.log('3. Link multiple SOs to single PO → Use PO items table');
    console.log('   (Recommended - matches real-world scenario)\n');
    console.log('4. Keep Excel PO in SO, generate unique internal PO numbers');
    console.log('   (Recommended - customer_po_number vs po_number)\n');
  }
}

checkDuplicates().catch(console.error);
