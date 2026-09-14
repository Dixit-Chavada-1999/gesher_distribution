#!/usr/bin/env node
/**
 * Check if Purchase Orders exist for GDC data
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

async function checkPurchaseOrders() {
  console.log('🔍 Checking Purchase Orders for GDC data...\n');

  // Check if POs exist for GDC data (PO-2024-00023 to PO-2024-00052)
  const { count: poCount } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact' })
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null);

  console.log('Purchase Orders found: ' + (poCount || 0) + ' / 30 expected\n');

  if (poCount === 0) {
    console.log('❌ NO PURCHASE ORDERS FOUND!\n');
    console.log('આ issue છે કારણ કે:');
    console.log('  - Sales Orders છે પણ Purchase Orders નથી');
    console.log('  - Galileo ને orders assign નથી');
    console.log('  - ETA dates PO પર નથી\n');
  } else {
    console.log('✅ Purchase Orders exist\n');

    // Check sample PO
    const { data: samplePO } = await supabase
      .from('purchase_orders')
      .select('po_number, supplier_id, status, expected_delivery_date')
      .gte('po_number', 'PO-2600023')
      .limit(1)
      .single();

    if (samplePO) {
      console.log('Sample PO: ' + samplePO.po_number);
      console.log('  Supplier ID: ' + (samplePO.supplier_id || '(not set)'));
      console.log('  Status: ' + (samplePO.status || '(not set)'));
      console.log('  Expected Delivery: ' + (samplePO.expected_delivery_date || '(not set)'));
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('RECOMMENDATION:');
  console.log('═══════════════════════════════════════\n');

  if (poCount === 0) {
    console.log('આપણે ingestion service માં PO creation add કરવાની જરૂર છે:');
    console.log('  1. For each Sales Order → Create Purchase Order');
    console.log('  2. Assign to Galileo supplier');
    console.log('  3. Set ETA dates from Excel');
    console.log('  4. Link PO to SO\n');
  } else {
    console.log('✅ Purchase Orders already exist - check if properly configured\n');
  }
}

checkPurchaseOrders().catch(console.error);
