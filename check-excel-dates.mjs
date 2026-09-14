#!/usr/bin/env node
/**
 * Check dates in Excel vs Database
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

async function checkDates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      CHECK DATES: Excel vs Database                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get POs with dates
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(`
      po_number,
      po_date,
      expected_delivery_date,
      sales_orders (
        order_number,
        order_date
      )
    `)
    .is('deleted_at', null)
    .order('po_number');

  console.log('PO Number         | PO Date    | SO Date    | ETA Date   | Issue?');
  console.log('─'.repeat(75));

  let dateIssues = 0;

  pos?.forEach(po => {
    const poDate = po.po_date || '(null)';
    const soDate = po.sales_orders?.order_date || '(null)';
    const etaDate = po.expected_delivery_date || '(null)';

    // Check if year is 2024 (wrong - should be 2026)
    const hasWrongYear = poDate.includes('2024') || soDate.includes('2024');

    const issue = hasWrongYear ? '❌ Wrong Year (2024)' : '✅';

    if (hasWrongYear) dateIssues++;

    console.log(
      po.po_number.padEnd(17) + ' | ' +
      poDate.substring(0, 10).padEnd(10) + ' | ' +
      soDate.substring(0, 10).padEnd(10) + ' | ' +
      etaDate.substring(0, 10).padEnd(10) + ' | ' +
      issue
    );
  });

  console.log('─'.repeat(75));
  console.log('\nSUMMARY:');
  console.log('  Total POs:      ' + (pos?.length || 0));
  console.log('  Date Issues:    ' + dateIssues);
  console.log('');

  if (dateIssues > 0) {
    console.log('❌ ISSUE: કેટલાક dates 2024 છે, પણ Excel માં 2026 છે!\n');
    console.log('Excel માં dates:');
    console.log('  - ETA to US Port: 7/21/2026, 8/5/2026, વગેરે');
    console.log('  - Confirmed ETA: 7/21/2026, 8/16/2026, વગેરે');
    console.log('  - All dates are in 2026, not 2024!\n');
  }

  // Check missing POs
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 MISSING PO CHECK:\n');

  const { data: allSOs } = await supabase
    .from('sales_orders')
    .select('order_number, customer_po_number')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600052')
    .is('deleted_at', null)
    .order('order_number');

  const soWithPONumbers = allSOs?.filter(so => so.customer_po_number && !so.customer_po_number.startsWith('Q')) || [];

  console.log('SOs with PO numbers in Excel: ' + soWithPONumbers.length);
  console.log('POs created in Database:      ' + (pos?.length || 0));
  console.log('');

  if (soWithPONumbers.length !== pos?.length) {
    console.log('❌ MISMATCH! કેટલાક POs create નથી થયા:\n');

    const createdPOSOs = new Set(pos?.map(po => po.sales_orders?.order_number) || []);

    soWithPONumbers.forEach(so => {
      if (!createdPOSOs.has(so.order_number)) {
        console.log('  - ' + so.order_number + ' → Excel PO: ' + so.customer_po_number + ' (PO not created)');
      }
    });
    console.log('');
  }
}

checkDates().catch(console.error);
