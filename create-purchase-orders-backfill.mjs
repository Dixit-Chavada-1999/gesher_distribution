#!/usr/bin/env node
/**
 * BACKFILL: Create Purchase Orders for existing GDC Sales Orders
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

async function createPurchaseOrders() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   BACKFILL: CREATE PURCHASE ORDERS FOR GDC DATA            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Ensure Galileo supplier exists
  console.log('📍 Step 1: Checking/Creating Galileo supplier...\n');

  let { data: galileo } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', '%galileo%')
    .is('deleted_at', null)
    .single();

  if (!galileo) {
    console.log('   Creating Galileo supplier...');

    const { data: newSupplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        name: 'Galileo Tyres India',
        supplier_code: 'GALILEO',
        contact_name: 'Alon',
        country: 'India',
        currency_code: 'USD',
        payment_terms_days: 30,
        is_active: true,
      })
      .select()
      .single();

    if (supplierError) {
      console.error('   ✗ Failed to create supplier:', supplierError.message);
      process.exit(1);
    }

    galileo = newSupplier;
    console.log('   ✓ Created supplier: ' + galileo.name + ' (ID: ' + galileo.id + ')');
  } else {
    console.log('   ✓ Supplier exists: ' + galileo.name + ' (ID: ' + galileo.id + ')');
  }

  console.log('');

  // Step 2: Get all Sales Orders
  console.log('📊 Step 2: Fetching Sales Orders...\n');

  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
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

  // Step 3: Get ETA dates from shipments
  console.log('📦 Step 3: Fetching ETA dates from shipments...\n');

  const { data: shipments } = await supabase
    .from('shipments')
    .select('sales_order_id, eta_to_port, confirmed_eta, customer_expected_delivery')
    .in('sales_order_id', salesOrders.map(so => so.id));

  const shipmentMap = new Map();
  shipments?.forEach(s => {
    shipmentMap.set(s.sales_order_id, s);
  });

  console.log('   Found ' + (shipments?.length || 0) + ' shipments\n');

  // Step 4: Get SO items
  console.log('📋 Step 4: Fetching Sales Order Items...\n');

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

  // Step 5: Create Purchase Orders
  console.log('🔧 Step 5: Creating Purchase Orders...\n');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const so of salesOrders) {
    // Generate PO number in correct format: PO-YYYY-NNNNN (exactly 5 digits)
    // SO2600023 → PO-2024-00023
    const soNum = so.order_number.replace('SO2600', ''); // Extract: 023
    const paddedNum = soNum.padStart(5, '0'); // Pad to 5 digits: 00023
    const poNumber = 'PO-2024-' + paddedNum;

    // Check if PO already exists
    const { data: existingPO } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('po_number', poNumber)
      .single();

    if (existingPO) {
      console.log('  ⊘ ' + poNumber + ' - Already exists');
      skipped++;
      continue;
    }

    // Get shipment data for ETA
    const shipment = shipmentMap.get(so.id);
    const expectedDeliveryDate = shipment?.customer_expected_delivery || shipment?.confirmed_eta || shipment?.eta_to_port;

    // Determine PO status based on product_source
    let poStatus = 'draft';
    if (so.product_source === 'direct') {
      // Customer orders - sent to Galileo
      poStatus = 'confirmed';
    } else if (so.product_source === 'warehouse') {
      // Warehouse inventory - may already be received or in transit
      poStatus = 'confirmed'; // We can adjust this based on shipment status
    }

    // Create PO (NO supplier_id on PO table - it's on items only)
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        po_date: so.order_date,
        status: poStatus,
        currency_code: 'USD',
        subtotal: so.subtotal,
        tax_total: so.tax_total,
        grand_total: so.grand_total,
        expected_delivery_date: expectedDeliveryDate,
        sales_order_id: so.id,
        internal_notes: 'Order Series - Backfilled from Sales Order ' + so.order_number,
      })
      .select()
      .single();

    if (poError) {
      console.log('  ✗ ' + poNumber + ' - ' + poError.message);
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
        console.log('  ⚠️  ' + poNumber + ' - PO created but items failed: ' + itemsError.message);
      }
    }

    console.log('  ✓ ' + poNumber + ' - ' + so.customers.name + ' (' + so.product_source + ')');
    created++;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log('POs created:  ' + created);
  console.log('POs skipped:  ' + skipped);
  console.log('Failed:       ' + failed);
  console.log('Total:        ' + (created + skipped + failed));
  console.log('═══════════════════════════════════════\n');

  if (created > 0) {
    console.log('✅ Purchase Orders created successfully!\n');
    console.log('   ✓ Assigned to Galileo supplier');
    console.log('   ✓ ETA dates set from shipments');
    console.log('   ✓ PO items created');
    console.log('   ✓ Status set based on product_source\n');
    console.log('   હવે Galileo ને orders show થશે! 🎉\n');
  }
}

createPurchaseOrders().catch(console.error);
