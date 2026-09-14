#!/usr/bin/env node
/**
 * Analyze PO situation - Excel vs Auto-generated
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

async function analyzeSituation() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      PO MISMATCH ANALYSIS                                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get sales orders with customer_po_number from Excel
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer_po_number')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  // Get existing auto-generated POs
  const { data: existingPOs } = await supabase
    .from('purchase_orders')
    .select('id, po_number, sales_order_id')
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null)
    .order('po_number');

  console.log('CURRENT SITUATION:');
  console.log('─'.repeat(80));
  console.log('SO Number  | Excel PO (Column G)      | Auto-generated PO      | Match?');
  console.log('─'.repeat(80));

  const poMap = new Map();
  existingPOs?.forEach(po => {
    poMap.set(po.sales_order_id, po.po_number);
  });

  let matches = 0;
  let mismatches = 0;
  let quotesInExcel = 0;

  salesOrders?.forEach(so => {
    const excelPO = so.customer_po_number || '(none)';
    const autoPO = poMap.get(so.id) || '(none)';
    const match = excelPO === autoPO ? '✓' : '✗';

    if (excelPO.startsWith('Q')) {
      quotesInExcel++;
    }

    if (match === '✓') matches++;
    else mismatches++;

    const line = `${so.order_number}   | ${excelPO.padEnd(24)} | ${autoPO.padEnd(22)} | ${match}`;
    console.log(line);
  });

  console.log('─'.repeat(80));
  console.log('\nSTATISTICS:');
  console.log('  Total orders:           ' + (salesOrders?.length || 0));
  console.log('  Matches:                ' + matches);
  console.log('  Mismatches:             ' + mismatches);
  console.log('  Quotes in Excel (Q):    ' + quotesInExcel);
  console.log('  PO numbers in Excel:    ' + ((salesOrders?.length || 0) - quotesInExcel));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('RECOMMENDATION:');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Option 1: Use Excel PO numbers where available');
  console.log('  - Delete auto-generated POs');
  console.log('  - Create POs with Excel numbers (PO-2600023, PO-N145669, etc.)');
  console.log('  - For "Q" numbers, either:');
  console.log('    a) Skip PO creation (keep as quotes only)');
  console.log('    b) Auto-generate PO numbers');
  console.log('');
  console.log('Option 2: Keep auto-generated, move Excel numbers elsewhere');
  console.log('  - Keep PO-2024-xxxxx as our internal PO numbers');
  console.log('  - Move Excel PO numbers to a different field');
  console.log('  - (Not recommended - causes confusion)');
  console.log('');

  console.log('❓ Which option should we use?\n');
}

analyzeSituation().catch(console.error);
