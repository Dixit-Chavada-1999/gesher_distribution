#!/usr/bin/env node
/**
 * Check wrong addresses in sales orders
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

async function checkWrongAddresses() {
  console.log('🔍 Checking addresses in sales orders...\n');

  // Check specific orders mentioned in screenshot
  const orderNumbers = [
    'SO2600041', 'SO2600042', 'SO2600043', 'SO2600044', // Valley - should be proper
    'SO2600050', 'SO2600051', 'SO2600052' // Kansas Warehouse - might be wrong
  ];

  for (const orderNum of orderNumbers) {
    const { data: so } = await supabase
      .from('sales_orders')
      .select('order_number, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_postal_code')
      .eq('order_number', orderNum)
      .single();

    if (so) {
      console.log(orderNum + ':');
      console.log('  Street: ' + (so.shipping_address_street || '(empty)'));
      console.log('  City: ' + (so.shipping_address_city || '(empty)'));
      console.log('  State: ' + (so.shipping_address_state || '(empty)'));
      console.log('  ZIP: ' + (so.shipping_address_postal_code || '(empty)'));

      // Check if it looks wrong (only ZIP, no city/state)
      if (so.shipping_address_postal_code && !so.shipping_address_city) {
        console.log('  ⚠️  WARNING: Only ZIP code, missing city/state!');
      }
      console.log('');
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('EXPECTED from Excel:');
  console.log('═══════════════════════════════════════');
  console.log('SO2600041: 79 S Hwy 83, McCook NE 69001');
  console.log('SO2600042: 28800 Ida Street Valley, NE 68064');
  console.log('SO2600043: 28800 Ida Street Valley, NE 68064');
  console.log('SO2600044: 28800 Ida Street Valley, NE 68064');
  console.log('SO2600050: 1216 Oregon Street, Hiawatha, KS 66434');
  console.log('SO2600051: 1216 Oregon Street, Hiawatha, KS 66434');
  console.log('SO2600052: 1216 Oregon Street, Hiawatha, KS 66434');
  console.log('═══════════════════════════════════════\n');
}

checkWrongAddresses().catch(console.error);
