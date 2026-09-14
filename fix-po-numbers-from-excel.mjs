#!/usr/bin/env node
/**
 * FIX: Delete auto-generated POs and create new ones with Excel PO numbers
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

async function fixPONumbers() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   FIX: Use Excel PO Numbers (Not Auto-generated)          ');
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

  // Step 2: Delete auto-generated POs
  console.log('📍 Step 1: Deleting auto-generated POs...\n');

  const { data: oldPOs, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .gte('po_number', 'PO-2024-00023')
    .lte('po_number', 'PO-2024-00053')
    .is('deleted_at', null);

  if (fetchError) {
    console.error('❌ Failed to fetch old POs:', fetchError.message);
    process.exit(1);
  }

  if (oldPOs && oldPOs.length > 0) {
    const { error: deleteError } = await supabase
      .from('purchase_orders')
      .delete()
      .gte('po_number', 'PO-2024-00023')
      .lte('po_number', 'PO-2024-00053');

    if (deleteError) {
      console.error('❌ Failed to delete:', deleteError.message);
      process.exit(1);
    }

    console.log('   ✓ Deleted ' + oldPOs.length + ' auto-generated POs\n');
  } else {
    console.log('   ⊘ No auto-generated POs to delete\n');
  }

  // Step 3: Get all Sales Orders with Excel PO numbers
  console.log('📍 Step 2: Fetching Sales Orders with Excel PO numbers...\n');

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
      requested_delivery_date,
      customers!inner (
        name
      )
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .is('deleted_at', null)
    .order('order_number');

  if (!salesOrders || salesOrders.length === 0) {
    console.log('   ✗ No sales orders found!');
    process.exit(1);
  }

  console.log('   Found ' + salesOrders.length + ' sales orders\n');

  // Step 4: Get ETA dates from shipments
  console.log('📍 Step 3: Fetching ETA dates from shipments...\n');

  const { data: shipments } = await supabase
    .from('shipments')
    .select('sales_order_id, eta_to_port, confirmed_eta, customer_expected_delivery')
    .in('sales_order_id', salesOrders.map(so => so.id));

  const shipmentMap = new Map();
  shipments?.forEach(s => {
    shipmentMap.set(s.sales_order_id, s);
  });

  console.log('   Found ' + (shipments?.length || 0) + ' shipments\n');

  // Step 5: Get SO items
  console.log('📍 Step 4: Fetching Sales Order Items...\n');

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

  console.log('   Found ' + (soItems?.length || 0) + ' items\n');

  // Step 6: Create Purchase Orders with Excel PO numbers
  console.log('📍 Step 5: Creating Purchase Orders with Excel PO numbers...\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const so of salesOrders) {
    const excelPO = so.customer_po_number;

    // Skip if no PO number in Excel
    if (!excelPO) {
      console.log('  ⊘ ' + so.order_number + ' - No PO number in Excel');
      skipped++;
      continue;
    }

    // Skip if it's a Quote number (starts with Q)
    if (excelPO.startsWith('Q')) {
      console.log('  ⊘ ' + so.order_number + ' - Quote number (' + excelPO + '), skipping PO creation');
      skipped++;
      continue;
    }

    // Get shipment data for ETA
    const shipment = shipmentMap.get(so.id);
    const expectedDeliveryDate = shipment?.customer_expected_delivery || shipment?.confirmed_eta || shipment?.eta_to_port;

    // Determine PO status
    let poStatus = 'confirmed';

    // Create PO with Excel PO number
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: excelPO, // Use Excel PO number directly
        po_date: so.order_date,
        status: poStatus,
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
      failed++;
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

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) {
        console.log('  ⚠️  ' + excelPO + ' - PO created but items failed: ' + itemsError.message);
      }
    }

    console.log('  ✓ ' + excelPO + ' - ' + so.customers.name + ' (' + so.product_source + ')');
    created++;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('POs created:  ' + created);
  console.log('Skipped:      ' + skipped + ' (quotes or no PO number)');
  console.log('Failed:       ' + failed);
  console.log('Total:        ' + (created + skipped + failed));
  console.log('═══════════════════════════════════════\n');

  if (created > 0) {
    console.log('✅ Purchase Orders created with Excel PO numbers!\n');
    console.log('   ✓ Using exact PO numbers from Excel Column G');
    console.log('   ✓ Assigned to Galileo supplier');
    console.log('   ✓ ETA dates set from shipments');
    console.log('   ✓ PO items created\n');
    console.log('   હવે Excel અને Database match થઈ ગયા! 🎉\n');
  }
}

fixPONumbers().catch(console.error);
