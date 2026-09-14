#!/usr/bin/env node
/**
 * Fix specific wrong addresses that were incorrectly copied from customer records
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

// Correct addresses from Excel
const correctAddresses = {
  'SO2600041': {
    street: '79 S Hwy 83',
    city: 'McCook',
    state: 'NE',
    zip: '69001',
    full: '79 S Hwy 83, McCook NE 69001'
  },
  'SO2600042': {
    street: '28800 Ida Street',
    city: 'Valley',
    state: 'NE',
    zip: '68064',
    full: '28800 Ida Street Valley, NE 68064'
  },
  'SO2600043': {
    street: '28800 Ida Street',
    city: 'Valley',
    state: 'NE',
    zip: '68064',
    full: '28800 Ida Street Valley, NE 68064'
  },
  'SO2600044': {
    street: '28800 Ida Street',
    city: 'Valley',
    state: 'NE',
    zip: '68064',
    full: '28800 Ida Street Valley, NE 68064'
  },
  'SO2600050': {
    street: '1216 Oregon Street',
    city: 'Hiawatha',
    state: 'KS',
    zip: '66434',
    full: '1216 Oregon Street, Hiawatha, KS 66434'
  },
  'SO2600051': {
    street: '1216 Oregon Street',
    city: 'Hiawatha',
    state: 'KS',
    zip: '66434',
    full: '1216 Oregon Street, Hiawatha, KS 66434'
  },
  'SO2600052': {
    street: '1216 Oregon Street',
    city: 'Hiawatha',
    state: 'KS',
    zip: '66434',
    full: '1216 Oregon Street, Hiawatha, KS 66434'
  }
};

async function fixWrongAddresses() {
  console.log('🔧 Fixing wrong addresses from Excel...\n');

  let fixed = 0;

  for (const [orderNum, correctAddr] of Object.entries(correctAddresses)) {
    // Update Sales Order
    const { error: soError } = await supabase
      .from('sales_orders')
      .update({
        shipping_address_street: correctAddr.street,
        shipping_address_city: correctAddr.city,
        shipping_address_state: correctAddr.state,
        shipping_address_postal_code: correctAddr.zip,
        shipping_address_country: 'US',
      })
      .eq('order_number', orderNum);

    if (soError) {
      console.log('  ✗ ' + orderNum + ': ' + soError.message);
      continue;
    }

    // Update Quote
    const quoteNum = orderNum.replace('SO', 'QT');
    const { error: qtError } = await supabase
      .from('quotes')
      .update({
        shipping_address_street: correctAddr.street,
        shipping_address_city: correctAddr.city,
        shipping_address_state: correctAddr.state,
        shipping_address_postal_code: correctAddr.zip,
        shipping_address_country: 'US',
        billing_address_street: correctAddr.street,
        billing_address_city: correctAddr.city,
        billing_address_state: correctAddr.state,
        billing_address_postal_code: correctAddr.zip,
        billing_address_country: 'US',
      })
      .eq('quote_number', quoteNum);

    if (qtError) {
      console.log('  ⚠️  ' + orderNum + ' (SO fixed, Quote failed): ' + qtError.message);
    } else {
      console.log('  ✓ ' + orderNum + ': ' + correctAddr.full);
      fixed++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('Fixed:  ' + fixed + '/' + Object.keys(correctAddresses).length);
  console.log('═══════════════════════════════════════\n');

  if (fixed === Object.keys(correctAddresses).length) {
    console.log('✅ All wrong addresses fixed!\n');
    console.log('   બધા wrong addresses correct થઈ ગયા છે!');
    console.log('   હવે system માં Excel જેવા જ proper addresses છે! 🎉\n');
  }
}

fixWrongAddresses().catch(console.error);
