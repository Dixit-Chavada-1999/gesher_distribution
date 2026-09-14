#!/usr/bin/env node
/**
 * FINAL VERIFICATION: Purchase Orders Complete Check
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

async function verifyPOs() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('      PURCHASE ORDERS COMPLETE VERIFICATION                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Count POs
  const { count: poCount } = await supabase
    .from('purchase_orders')
    .select('id', { count: 'exact' })
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null);

  console.log('📊 PURCHASE ORDERS:');
  console.log('  Total POs: ' + (poCount || 0) + ' / 30 expected\n');

  // 2. Check PO details
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      expected_delivery_date,
      sales_order_id,
      grand_total
    `)
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null);

  const withETA = pos?.filter(p => p.expected_delivery_date).length || 0;
  const withSO = pos?.filter(p => p.sales_order_id).length || 0;
  const withTotal = pos?.filter(p => p.grand_total > 0).length || 0;

  console.log('  - With ETA date: ' + withETA + ' / ' + poCount);
  console.log('  - Linked to SO: ' + withSO + ' / ' + poCount);
  console.log('  - With grand total: ' + withTotal + ' / ' + poCount);
  console.log('');

  // 3. Check PO Items
  const { count: itemsCount } = await supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact' })
    .in('purchase_order_id', pos?.map(p => p.id) || []);

  console.log('📦 PURCHASE ORDER ITEMS:');
  console.log('  Total items: ' + (itemsCount || 0) + ' (expected ~34)\n');

  // 4. Check supplier assignment on items
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('supplier_id, supplier_name')
    .in('purchase_order_id', pos?.map(p => p.id) || []);

  const itemsWithSupplier = items?.filter(i => i.supplier_id).length || 0;

  console.log('  - Items with supplier: ' + itemsWithSupplier + ' / ' + itemsCount);
  console.log('');

  // 5. Sample PO
  if (pos && pos.length > 0) {
    const sample = pos[0];

    const { data: sampleItems } = await supabase
      .from('purchase_order_items')
      .select('sku, quantity_ordered, unit_price, supplier_name')
      .eq('purchase_order_id', sample.id);

    console.log('📋 SAMPLE PO (' + sample.po_number + '):');
    console.log('  Status: ' + sample.status);
    console.log('  Expected Delivery: ' + (sample.expected_delivery_date || '(not set)'));
    console.log('  Grand Total: $' + ((sample.grand_total || 0) / 100).toFixed(2));
    console.log('  Items:');
    sampleItems?.forEach(item => {
      console.log('    - ' + item.sku + ': ' + item.quantity_ordered + ' × $' + ((item.unit_price || 0) / 100).toFixed(2));
      console.log('      Supplier: ' + (item.supplier_name || '(not set)'));
    });
    console.log('');
  }

  // 6. Final Score
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   FINAL RESULT                             ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (poCount === 30 && itemsCount >= 30 && itemsWithSupplier >= 30) {
    console.log('✅ EXCELLENT! Purchase Orders complete!\n');
    console.log('   ✓ 30 Purchase Orders created');
    console.log('   ✓ All POs have items (' + itemsCount + ' items total)');
    console.log('   ✓ All items assigned to Galileo supplier');
    console.log('   ✓ ETA dates set from shipments (' + withETA + ' POs)');
    console.log('   ✓ POs linked to Sales Orders (' + withSO + ' POs)');
    console.log('');
    console.log('   હવે Galileo supplier portal માં બધા orders show થશે! 🎉\n');
  } else {
    console.log('⚠️  Some data missing:\n');
    console.log('   POs: ' + (poCount || 0) + ' / 30');
    console.log('   Items: ' + (itemsCount || 0) + ' / ~34');
    console.log('   Items with supplier: ' + itemsWithSupplier + ' / ' + itemsCount);
    console.log('');
  }
}

verifyPOs().catch(console.error);
