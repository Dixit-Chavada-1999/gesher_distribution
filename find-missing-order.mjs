#!/usr/bin/env node
/**
 * Find missing order SO2600053
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

async function findMissingOrder() {
  console.log('🔍 Searching for SO2600053 in database...\n');

  // Check sales orders (including deleted)
  const { data: so } = await supabase
    .from('sales_orders')
    .select('order_number, deleted_at, created_at, order_series')
    .eq('order_number', 'SO2600053')
    .maybeSingle();

  if (so) {
    console.log('✅ FOUND in sales_orders:');
    console.log(`   Order Number: ${so.order_number}`);
    console.log(`   Order Series: ${so.order_series}`);
    console.log(`   Deleted: ${so.deleted_at ? 'YES' : 'NO'}`);
    console.log(`   Created: ${so.created_at}`);
  } else {
    console.log('❌ NOT FOUND in sales_orders');
  }

  console.log('\n');

  // Check quotes
  const { data: quote } = await supabase
    .from('quotes')
    .select('quote_number, deleted_at, created_at')
    .eq('quote_number', 'QT2600053')
    .maybeSingle();

  if (quote) {
    console.log('✅ FOUND in quotes:');
    console.log(`   Quote Number: ${quote.quote_number}`);
    console.log(`   Deleted: ${quote.deleted_at ? 'YES' : 'NO'}`);
    console.log(`   Created: ${quote.created_at}`);
  } else {
    console.log('❌ NOT FOUND in quotes');
  }

  console.log('\n');

  // List all GDC 1 orders to see the gap
  const { data: gdc1Orders } = await supabase
    .from('sales_orders')
    .select('order_number, order_series')
    .eq('order_series', 'GDC 1')
    .gte('order_number', 'SO2600037')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  console.log('GDC 1 Orders in Database:');
  gdc1Orders?.forEach((o, idx) => {
    console.log(`   ${idx + 1}. ${o.order_number}`);
  });

  console.log('\n');
  console.log('Expected GDC 1 Orders:');
  const expected = [];
  for (let i = 37; i <= 53; i++) {
    expected.push(`SO2600${String(i).padStart(3, '0')}`);
  }
  expected.forEach((num, idx) => {
    const exists = gdc1Orders?.some(o => o.order_number === num);
    console.log(`   ${idx + 1}. ${num} ${exists ? '✓' : '❌ MISSING'}`);
  });
}

findMissingOrder().catch(console.error);
