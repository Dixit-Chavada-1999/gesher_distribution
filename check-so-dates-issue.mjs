#!/usr/bin/env node
/**
 * Check Sales Order dates - why are some 2024?
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

async function checkSODates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      CHECK SALES ORDER DATES                              ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: orders } = await supabase
    .from('sales_orders')
    .select('order_number, order_date, order_series')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  console.log('SO Number   | Order Date | Order Series | Issue?');
  console.log('─'.repeat(60));

  let wrongDates = 0;
  let gdc0Count = 0;
  let gdc1Count = 0;

  orders?.forEach(order => {
    const date = order.order_date || '(null)';
    const series = order.order_series || '(null)';
    const isWrong = date.startsWith('2024');

    if (isWrong) wrongDates++;
    if (series === 'GDC 1') gdc1Count++;
    if (series === 'GDC 0') gdc0Count++;

    const issue = isWrong ? '❌ Wrong (2024)' : '✅ Correct (2026)';

    console.log(
      order.order_number + '   | ' +
      date.substring(0, 10).padEnd(10) + ' | ' +
      series.padEnd(12) + ' | ' +
      issue
    );
  });

  console.log('─'.repeat(60));
  console.log('\nSUMMARY:');
  console.log('  Total Orders:    ' + (orders?.length || 0));
  console.log('  GDC 0 Orders:    ' + gdc0Count);
  console.log('  GDC 1 Orders:    ' + gdc1Count);
  console.log('  Wrong Dates:     ' + wrongDates + ' (should be 2026)');
  console.log('');

  if (wrongDates > 0) {
    console.log('❌ ISSUE FOUND!\n');
    console.log('GDC 1 નો data ingestion વખતે dates properly parse નહોતા થયા.');
    console.log('Default 2024-01-01 set થઈ ગયો.\n');
    console.log('Excel માં actual dates શું છે તે check કરીને manually fix કરવા પડશે.\n');
    console.log('Excel expected dates (from screenshot):');
    console.log('  - SO2600037: Should be around 2026');
    console.log('  - SO2600045-046: Should be around 2026');
    console.log('  - SO2600047-052: Should be around 2026\n');
  }
}

checkSODates().catch(console.error);
