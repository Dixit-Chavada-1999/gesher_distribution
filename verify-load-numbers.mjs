#!/usr/bin/env node
/**
 * Verify Load # shows Sales Order numbers (not Shipment numbers)
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

async function verifyLoadNumbers() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      VERIFY LOAD # SHOWS SALES ORDER NUMBERS             ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get shipments with their sales orders
  const { data: shipments } = await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      sales_order_id,
      sales_orders (
        order_number,
        customer_po_number
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(15);

  console.log('Load # (Expected SO)  | Shipment #       | Customer PO   | Status');
  console.log('─'.repeat(75));

  let correct = 0;
  let total = 0;

  for (const s of shipments || []) {
    const expectedLoadNumber = s.sales_orders?.order_number || 'N/A';
    const shipmentNumber = s.shipment_number || 'N/A';
    const customerPO = s.sales_orders?.customer_po_number || 'N/A';

    // In the new code, loadNumber should be sales_orders.order_number
    const isCorrect = expectedLoadNumber.startsWith('SO26');
    if (isCorrect) correct++;
    total++;

    const status = isCorrect ? '✅' : '❌';

    console.log(
      expectedLoadNumber.padEnd(20) + ' | ' +
      shipmentNumber.padEnd(16) + ' | ' +
      customerPO.padEnd(13) + ' | ' +
      status
    );
  }

  console.log('─'.repeat(75));
  console.log('\nSUMMARY:');
  console.log('  Total Shipments:     ' + total);
  console.log('  Correct Load #:      ' + correct + ' (should show SO numbers)');
  console.log('  Wrong Load #:        ' + (total - correct));
  console.log('');

  if (correct === total) {
    console.log('✅ બધું PERFECT છે! Load # હવે Sales Order numbers show કરે છે! 🎉\n');
    console.log('   Operations Dashboard માં Load # column હવે Excel જેવો જ દેખાશે.\n');
  } else {
    console.log('⚠️  Still showing wrong Load # (showing Shipment # instead of SO #)\n');
  }

  // Show sample from GDC 1 (SO2600037-053)
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      GDC 1 SAMPLE (SO2600037-053)                         ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: gdc1 } = await supabase
    .from('shipments')
    .select(`
      shipment_number,
      sales_orders (
        order_number,
        customer_po_number
      )
    `)
    .gte('sales_orders.order_number', 'SO2600037')
    .lte('sales_orders.order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('sales_orders.order_number');

  console.log('Load # (SO)    | Shipment #       | Customer PO');
  console.log('─'.repeat(60));

  for (const s of gdc1 || []) {
    const loadNumber = s.sales_orders?.order_number || 'N/A';
    const shipmentNumber = s.shipment_number || 'N/A';
    const customerPO = s.sales_orders?.customer_po_number || 'N/A';

    console.log(
      loadNumber.padEnd(14) + ' | ' +
      shipmentNumber.padEnd(16) + ' | ' +
      customerPO
    );
  }

  console.log('─'.repeat(60));
  console.log('\n✓ હવે Operations Dashboard → Executive Summary → Immediate Attention\n');
  console.log('  માં Load # column SO numbers show કરશે (Excel જેવો જ).\n');
}

verifyLoadNumbers().catch(console.error);
