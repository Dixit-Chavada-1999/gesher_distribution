#!/usr/bin/env node
/**
 * BACKFILL: Create PO Items for existing Purchase Orders
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

async function createPOItems() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   BACKFILL: CREATE PO ITEMS FOR EXISTING POS               ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get Galileo supplier
  const { data: galileo } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', '%galileo%')
    .single();

  if (!galileo) {
    console.error('❌ Galileo supplier not found!');
    process.exit(1);
  }

  console.log('✓ Using supplier: ' + galileo.name + '\n');

  // Get all GDC Purchase Orders
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id, po_number, sales_order_id')
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null)
    .order('po_number');

  if (!pos || pos.length === 0) {
    console.log('❌ No POs found!');
    process.exit(1);
  }

  console.log('Found ' + pos.length + ' Purchase Orders\n');

  // Get Sales Order items for these POs
  const soIds = pos.map(po => po.sales_order_id).filter(Boolean);

  const { data: soItems } = await supabase
    .from('sales_order_items')
    .select('sales_order_id, product_id, sku, description, quantity, unit_price, line_total')
    .in('sales_order_id', soIds);

  const itemsMap = new Map();
  soItems?.forEach(item => {
    if (!itemsMap.has(item.sales_order_id)) {
      itemsMap.set(item.sales_order_id, []);
    }
    itemsMap.get(item.sales_order_id).push(item);
  });

  console.log('Found ' + (soItems?.length || 0) + ' SO items\n');
  console.log('Creating PO items...\n');

  let created = 0;
  let skipped = 0;

  for (const po of pos) {
    // Check if items already exist
    const { count: existingCount } = await supabase
      .from('purchase_order_items')
      .select('id', { count: 'exact' })
      .eq('purchase_order_id', po.id);

    if (existingCount && existingCount > 0) {
      console.log('  ⊘ ' + po.po_number + ' - Items already exist (' + existingCount + ')');
      skipped++;
      continue;
    }

    // Get SO items
    const items = itemsMap.get(po.sales_order_id) || [];
    if (items.length === 0) {
      console.log('  ⊘ ' + po.po_number + ' - No SO items found');
      skipped++;
      continue;
    }

    // Create PO items
    const poItems = items.map(item => ({
      purchase_order_id: po.id,
      product_id: item.product_id,
      sku: item.sku,
      description: item.description,
      quantity_ordered: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      supplier_id: galileo.id,
      supplier_name: galileo.name,
    }));

    const { error } = await supabase
      .from('purchase_order_items')
      .insert(poItems);

    if (error) {
      console.log('  ✗ ' + po.po_number + ' - ' + error.message);
    } else {
      console.log('  ✓ ' + po.po_number + ' - Created ' + poItems.length + ' items');
      created++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('POs with items created:  ' + created);
  console.log('POs skipped:             ' + skipped);
  console.log('Total:                   ' + (created + skipped));
  console.log('═══════════════════════════════════════\n');

  if (created > 0) {
    console.log('✅ PO Items created successfully!\n');
    console.log('   હવે Galileo ને બધી items show થશે! 🎉\n');
  }
}

createPOItems().catch(console.error);
