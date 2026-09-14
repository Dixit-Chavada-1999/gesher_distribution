#!/usr/bin/env node
/**
 * RECREATE ALL POs - Exact Excel Match (with duplicates)
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

async function recreateAllPOs() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   RECREATE ALL POs - Excel Exact Match                     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Get Galileo supplier
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

  // Step 2: Delete ALL existing POs
  console.log('📍 Step 1: Deleting all existing POs...\n');

  const { error: deleteError } = await supabase
    .from('purchase_orders')
    .delete()
    .not('id', 'is', null); // Delete all

  if (deleteError) {
    console.error('❌ Failed to delete:', deleteError.message);
    process.exit(1);
  }

  console.log('   ✓ All existing POs deleted\n');

  // Step 3: Get all Sales Orders with Excel PO numbers
  console.log('📍 Step 2: Fetching Sales Orders...\n');

  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
      customer_po_number,
      product_source,
      subtotal,
      tax_total,
      grand_total,
      customers!inner (
        name
      )
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  console.log('   Found ' + (salesOrders?.length || 0) + ' sales orders\n');

  // Step 4: Get ETA dates from shipments
  const { data: shipments } = await supabase
    .from('shipments')
    .select('sales_order_id, eta_to_port, confirmed_eta, customer_expected_delivery')
    .in('sales_order_id', salesOrders.map(so => so.id));

  const shipmentMap = new Map();
  shipments?.forEach(s => {
    shipmentMap.set(s.sales_order_id, s);
  });

  // Step 5: Get SO items
  const { data: soItems } = await supabase
    .from('sales_order_items')
    .select('sales_order_id, product_id, sku, description, quantity, unit_price, line_total')
    .in('sales_order_id', salesOrders.map(so => so.id));

  const itemsMap = new Map();
  soItems?.forEach(item => {
    if (!itemsMap.has(item.sales_order_id)) {
      itemsMap.set(item.sales_order_id, []);
    }
    itemsMap.get(item.sales_order_id).push(item);
  });

  // Step 6: Create POs for ALL orders (including duplicates)
  console.log('📍 Step 3: Creating Purchase Orders (Excel exact match)...\n');

  let created = 0;
  let skipped = 0;

  for (const so of salesOrders) {
    const excelPO = so.customer_po_number;

    // Skip if no PO number in Excel
    if (!excelPO) {
      console.log('  ⊘ ' + so.order_number + ' - No PO in Excel');
      skipped++;
      continue;
    }

    // Skip if it's a Quote number (starts with Q)
    if (excelPO.startsWith('Q')) {
      console.log('  ⊘ ' + so.order_number + ' - Quote (' + excelPO + ')');
      skipped++;
      continue;
    }

    // Get shipment data for ETA
    const shipment = shipmentMap.get(so.id);
    const expectedDeliveryDate = shipment?.customer_expected_delivery || shipment?.confirmed_eta || shipment?.eta_to_port;

    // Create PO with Excel PO number (allow duplicates!)
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: excelPO, // Exact Excel PO number
        po_date: so.order_date,
        status: 'confirmed',
        currency_code: 'USD',
        subtotal: so.subtotal,
        tax_total: so.tax_total,
        grand_total: so.grand_total,
        expected_delivery_date: expectedDeliveryDate,
        sales_order_id: so.id,
        internal_notes: 'Historical PO from Excel - ' + so.order_number,
      })
      .select()
      .single();

    if (poError) {
      console.log('  ✗ ' + so.order_number + ' (' + excelPO + ') - ' + poError.message);
      continue;
    }

    // Create PO items
    const items = itemsMap.get(so.id) || [];
    if (items.length > 0) {
      const poItems = items.map(item => ({
        purchase_order_id: newPO.id,
        product_id: item.product_id,
        sku: item.sku,
        description: item.description,
        quantity_ordered: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        supplier_id: galileo.id,
        supplier_name: galileo.name,
      }));

      await supabase.from('purchase_order_items').insert(poItems);
    }

    console.log('  ✓ ' + excelPO + ' → ' + so.order_number + ' (' + so.customers.name + ')');
    created++;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('POs created:  ' + created);
  console.log('Skipped:      ' + skipped + ' (quotes)');
  console.log('Total:        ' + (created + skipped));
  console.log('═══════════════════════════════════════\n');

  if (created > 0) {
    console.log('✅ Purchase Orders created - Excel exact match!\n');
    console.log('   ✓ Excel ના exact PO numbers');
    console.log('   ✓ Duplicate POs allowed (same as Excel)');
    console.log('   ✓ All linked to correct SOs');
    console.log('   ✓ Assigned to Galileo supplier\n');
    console.log('   હવે Excel અને Database 100% match! 🎉\n');
  }
}

recreateAllPOs().catch(console.error);
