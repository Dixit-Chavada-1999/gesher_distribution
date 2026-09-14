#!/usr/bin/env node
/**
 * Verify complete data import
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           DATA IMPORT VERIFICATION REPORT                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Check Sales Orders
  console.log('📊 1. SALES ORDERS\n');

  const { data: orders, count: orderCount } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      shipping_address_country,
      customer_po_number
    `, { count: 'exact' })
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600052')
    .is('deleted_at', null);

  console.log(`   Total Orders: ${orderCount}`);

  const withStreet = orders?.filter(o => o.shipping_address_street).length || 0;
  const withCity = orders?.filter(o => o.shipping_address_city).length || 0;
  const withState = orders?.filter(o => o.shipping_address_state).length || 0;
  const withZip = orders?.filter(o => o.shipping_address_postal_code).length || 0;
  const withPO = orders?.filter(o => o.customer_po_number).length || 0;

  console.log(`   - With street: ${withStreet}/${orderCount}`);
  console.log(`   - With city: ${withCity}/${orderCount}`);
  console.log(`   - With state: ${withState}/${orderCount}`);
  console.log(`   - With ZIP: ${withZip}/${orderCount}`);
  console.log(`   - With PO: ${withPO}/${orderCount}`);

  // Show sample address
  if (orders && orders.length > 0) {
    const sample = orders.find(o => o.shipping_address_city);
    if (sample) {
      console.log(`\n   Sample Address (${sample.order_number}):`);
      console.log(`   ${sample.shipping_address_street || '(none)'}`);
      console.log(`   ${sample.shipping_address_city || '(none)'}, ${sample.shipping_address_state || '(none)'} ${sample.shipping_address_postal_code || '(none)'}`);
    }
  }

  console.log('');

  // 2. Check Shipments
  console.log('📦 2. SHIPMENTS\n');

  const { data: shipments, count: shipmentCount } = await supabase
    .from('shipments')
    .select(`
      shipment_number,
      supplier_reference_number,
      eta_to_port,
      confirmed_eta,
      customer_expected_delivery,
      qty_delivered,
      outstanding_qty,
      total_qty,
      action_required,
      load_status
    `, { count: 'exact' })
    .in('supplier_reference_number', orders?.map(o => o.order_number) || [])
    .is('deleted_at', null);

  console.log(`   Total Shipments: ${shipmentCount}`);

  const withETA = shipments?.filter(s => s.eta_to_port).length || 0;
  const withConfirmedETA = shipments?.filter(s => s.confirmed_eta).length || 0;
  const withExpectedDelivery = shipments?.filter(s => s.customer_expected_delivery).length || 0;
  const withQty = shipments?.filter(s => s.total_qty > 0).length || 0;
  const withNotes = shipments?.filter(s => s.action_required).length || 0;
  const withStatus = shipments?.filter(s => s.load_status).length || 0;

  console.log(`   - With ETA to Port: ${withETA}/${shipmentCount}`);
  console.log(`   - With Confirmed ETA: ${withConfirmedETA}/${shipmentCount}`);
  console.log(`   - With Expected Delivery: ${withExpectedDelivery}/${shipmentCount}`);
  console.log(`   - With Total Qty: ${withQty}/${shipmentCount}`);
  console.log(`   - With Notes: ${withNotes}/${shipmentCount}`);
  console.log(`   - With Load Status: ${withStatus}/${shipmentCount}`);

  // Show sample shipment
  if (shipments && shipments.length > 0) {
    const sample = shipments.find(s => s.eta_to_port);
    if (sample) {
      console.log(`\n   Sample Shipment (${sample.shipment_number}):`);
      console.log(`   SO: ${sample.supplier_reference_number}`);
      console.log(`   ETA to Port: ${sample.eta_to_port || '(none)'}`);
      console.log(`   Confirmed ETA: ${sample.confirmed_eta || '(none)'}`);
      console.log(`   Expected Delivery: ${sample.customer_expected_delivery || '(none)'}`);
      console.log(`   Qty: ${sample.total_qty || 0}`);
      console.log(`   Status: ${sample.load_status || '(none)'}`);
      if (sample.action_required) {
        console.log(`   Notes: ${sample.action_required.substring(0, 50)}...`);
      }
    }
  }

  console.log('');

  // 3. Final Score
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    FINAL SCORE                            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalFields = 15; // Fields we're checking
  let savedFields = 0;

  if (orderCount === 30) savedFields++;
  if (withCity >= 25) savedFields++;
  if (withState >= 25) savedFields++;
  if (withZip >= 25) savedFields++;
  if (withPO >= 20) savedFields++;

  if (shipmentCount === 30) savedFields++;
  if (withETA >= 20) savedFields++;
  if (withConfirmedETA >= 15) savedFields++;
  if (withExpectedDelivery >= 20) savedFields++;
  if (withQty >= 25) savedFields++;
  if (withNotes >= 10) savedFields++;
  if (withStatus === 30) savedFields++;

  const percentage = Math.round((savedFields / totalFields) * 100);

  console.log(`   Fields Checked: ${totalFields}`);
  console.log(`   Fields Saved: ${savedFields}`);
  console.log(`   Score: ${percentage}%`);
  console.log('');

  if (percentage >= 90) {
    console.log('✅ EXCELLENT! All data properly imported!\n');
    console.log('   બધા fields properly save થયા છે:');
    console.log('   ✓ Addresses parsed (street, city, state, ZIP)');
    console.log('   ✓ Shipments created with tracking data');
    console.log('   ✓ ETA dates, quantities, and notes saved');
    console.log('   ✓ Load status tracking enabled');
    console.log('');
    console.log('   Operations Dashboard માં બધો data show થશે! 🎉');
    return true;
  } else if (percentage >= 70) {
    console.log('⚠️  GOOD - Most data imported, some fields missing\n');
    return true;
  } else {
    console.log('❌ INCOMPLETE - Many fields missing\n');
    return false;
  }
}

verify()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });
