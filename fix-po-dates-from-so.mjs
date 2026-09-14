#!/usr/bin/env node
/**
 * Fix PO dates from Sales Order dates (which are from Excel)
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

async function fixPODates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   FIX PO DATES: Copy from Sales Orders                     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all POs with their SOs
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      po_date,
      sales_order_id,
      sales_orders (
        order_number,
        order_date
      )
    `)
    .is('deleted_at', null);

  console.log('Found ' + (pos?.length || 0) + ' Purchase Orders\n');

  let fixed = 0;
  let skipped = 0;

  console.log('PO Number         | Old PO Date | SO Date     | Action');
  console.log('─'.repeat(70));

  for (const po of pos || []) {
    const soDate = po.sales_orders?.order_date;

    if (!soDate) {
      console.log(po.po_number.padEnd(17) + ' | (no SO date)                   | ⊘ Skip');
      skipped++;
      continue;
    }

    // Check if PO date is wrong (2024 or null)
    const needsFix = !po.po_date || po.po_date.startsWith('2024');

    if (needsFix) {
      // Update PO date to match SO date
      const { error } = await supabase
        .from('purchase_orders')
        .update({ po_date: soDate })
        .eq('id', po.id);

      if (error) {
        console.log(po.po_number.padEnd(17) + ' | ERROR: ' + error.message);
      } else {
        const oldDate = (po.po_date || '(null)').substring(0, 10);
        const newDate = soDate.substring(0, 10);
        console.log(po.po_number.padEnd(17) + ' | ' + oldDate.padEnd(11) + ' | ' + newDate.padEnd(11) + ' | ✓ Fixed');
        fixed++;
      }
    } else {
      console.log(po.po_number.padEnd(17) + ' | ' + po.po_date.substring(0, 10).padEnd(11) + ' | ' + soDate.substring(0, 10).padEnd(11) + ' | ✓ OK');
      skipped++;
    }
  }

  console.log('─'.repeat(70));
  console.log('\nSUMMARY:');
  console.log('  Fixed:   ' + fixed);
  console.log('  Skipped: ' + skipped + ' (already correct)');
  console.log('  Total:   ' + (pos?.length || 0));
  console.log('');

  if (fixed > 0) {
    console.log('✅ PO dates fixed!\n');
    console.log('   હવે બધી dates Excel મુજબ 2026 માં છે! 🎉\n');
  }
}

fixPODates().catch(console.error);
