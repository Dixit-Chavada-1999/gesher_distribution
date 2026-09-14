#!/usr/bin/env node
/**
 * Check if POs are linked to Sales Orders
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

async function checkLinks() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      CHECK: PO → SO Link Status                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(`
      po_number,
      sales_order_id,
      sales_orders (
        order_number
      )
    `)
    .is('deleted_at', null)
    .order('po_number');

  console.log('Total POs: ' + (pos?.length || 0) + '\n');

  console.log('PO Number         | Linked to SO?    | SO Number');
  console.log('─'.repeat(65));

  let linkedCount = 0;
  let notLinkedCount = 0;

  pos?.forEach(po => {
    const hasLink = po.sales_order_id ? '✅ Yes' : '❌ No';
    const soNumber = po.sales_orders?.order_number || '(none)';

    if (po.sales_order_id) linkedCount++;
    else notLinkedCount++;

    console.log(po.po_number.padEnd(17) + ' | ' + hasLink.padEnd(16) + ' | ' + soNumber);
  });

  console.log('─'.repeat(65));
  console.log('\nSUMMARY:');
  console.log('  Linked:     ' + linkedCount);
  console.log('  Not Linked: ' + notLinkedCount);
  console.log('');

  if (notLinkedCount > 0) {
    console.log('❌ ISSUE: ' + notLinkedCount + ' POs are not linked to Sales Orders!\n');
    console.log('This happened because POs were created but sales_order_id was not set.\n');
  } else {
    console.log('✅ All POs are properly linked to Sales Orders! 🎉\n');
  }
}

checkLinks().catch(console.error);
