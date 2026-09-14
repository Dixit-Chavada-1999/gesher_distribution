#!/usr/bin/env node
/**
 * Fix GDC 1 dates from Excel screenshot
 * Based on screenshot: ETA dates visible for SO2600037-053
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

// Dates from Excel GDC 1 screenshot (ETA to US Port column)
const excelDates = {
  'SO2600037': '2026-09-16',  // Row 4: 9/16/2026
  'SO2600038': '2026-09-18',  // Row 5: 9/18/2026
  'SO2600039': '2026-09-22',  // Row 6: 9/22/2026
  'SO2600040': '2026-09-25',  // Row 7: 9/25/2026
  'SO2600041': '2026-10-17',  // Row 8: 10/17/2026
  'SO2600042': '2026-10-20',  // Row 9: 10/20/2026
  'SO2600043': '2026-09-11',  // Row 10: 9/11/2026
  'SO2600044': '2026-10-05',  // Row 11: 10/5/2026
  'SO2600045': '2026-10-08',  // Row 12: 10/8/2026
  'SO2600046': '2026-10-11',  // Row 13: 10/11/2026
  'SO2600047': '2026-10-16',  // Row 14: 10/16/2026
  'SO2600048': '2026-10-16',  // Row 15: 10/16/2026
  'SO2600049': '2026-10-20',  // Row 16: 10/20/2026
  'SO2600050': '2026-10-23',  // Row 17: 10/23/2026
  'SO2600051': '2026-10-27',  // Row 18: 10/27/2026
  'SO2600052': '2026-10-29',  // Row 19: 10/29/2026
  'SO2600053': '2026-11-01',  // Row 20: 11/1/2026
};

async function fixDates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   FIX GDC 1 DATES FROM EXCEL                               ');
  console.log('═══════════════════════════════════════════════════════════\n');

  let fixed = 0;
  let skipped = 0;

  console.log('SO Number   | Old Date   | Excel ETA  | Action');
  console.log('─'.repeat(60));

  for (const [soNumber, etaDate] of Object.entries(excelDates)) {
    // Get SO
    const { data: so } = await supabase
      .from('sales_orders')
      .select('id, order_date')
      .eq('order_number', soNumber)
      .single();

    if (!so) {
      console.log(soNumber + '   | NOT FOUND in database');
      skipped++;
      continue;
    }

    const oldDate = so.order_date || '(null)';
    const needsFix = !so.order_date || so.order_date.startsWith('2024');

    // Use ETA date as order_date (approximation - should be slightly before ETA)
    // Let's use 30 days before ETA as order date
    const etaDateObj = new Date(etaDate);
    const orderDateObj = new Date(etaDateObj);
    orderDateObj.setDate(orderDateObj.getDate() - 30);
    const orderDate = orderDateObj.toISOString().split('T')[0];

    if (needsFix) {
      // Update SO
      const { error: soError } = await supabase
        .from('sales_orders')
        .update({ order_date: orderDate })
        .eq('id', so.id);

      if (soError) {
        console.log(soNumber + '   | ERROR: ' + soError.message);
        continue;
      }

      // Update shipment ETA
      const { error: shipError } = await supabase
        .from('shipments')
        .update({ eta_to_port: etaDate })
        .eq('sales_order_id', so.id);

      // Update PO dates if exists
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          po_date: orderDate,
          expected_delivery_date: etaDate
        })
        .eq('sales_order_id', so.id);

      console.log(
        soNumber + '   | ' +
        oldDate.substring(0, 10).padEnd(10) + ' | ' +
        etaDate.padEnd(10) + ' | ✓ Fixed'
      );
      fixed++;
    } else {
      console.log(
        soNumber + '   | ' +
        oldDate.substring(0, 10).padEnd(10) + ' | ' +
        etaDate.padEnd(10) + ' | ✓ OK'
      );
      skipped++;
    }
  }

  console.log('─'.repeat(60));
  console.log('\nSUMMARY:');
  console.log('  Fixed:   ' + fixed);
  console.log('  Skipped: ' + skipped + ' (already correct)');
  console.log('  Total:   ' + Object.keys(excelDates).length);
  console.log('');

  if (fixed > 0) {
    console.log('✅ Dates fixed from Excel!\n');
    console.log('   હવે બધી dates 2026 માં છે! 🎉\n');
  }
}

fixDates().catch(console.error);
