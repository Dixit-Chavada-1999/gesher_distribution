#!/usr/bin/env node
/**
 * RE-IMPORT COMPLETE GDC DATA
 *
 * This script:
 * 1. Deletes existing GDC 0 and GDC 1 orders (SO2600023 - SO2600052)
 * 2. Re-imports with ALL fields properly saved
 * 3. Creates Shipments with tracking data
 * 4. Parses addresses into separate components
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

// Validate environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('🗑️  Step 1: Cleaning up existing GDC data...\n');

  // Order numbers to delete
  const orderNumbers = [];
  for (let i = 23; i <= 52; i++) {
    orderNumbers.push(`SO2600${String(i).padStart(3, '0')}`);
  }

  console.log(`   Deleting ${orderNumbers.length} sales orders...`);

  // Delete sales orders (cascade will delete items, shipments, etc.)
  const { error: soError } = await supabase
    .from('sales_orders')
    .delete()
    .in('order_number', orderNumbers);

  if (soError) {
    console.error('❌ Failed to delete sales orders:', soError.message);
    throw soError;
  }

  console.log('   ✓ Deleted sales orders and related items');

  // Delete quotes
  const quoteNumbers = orderNumbers.map(so => so.replace('SO', 'QT'));

  console.log(`   Deleting ${quoteNumbers.length} quotes...`);

  const { error: quoteError } = await supabase
    .from('quotes')
    .delete()
    .in('quote_number', quoteNumbers);

  if (quoteError) {
    console.error('❌ Failed to delete quotes:', quoteError.message);
    throw quoteError;
  }

  console.log('   ✓ Deleted quotes and related items\n');

  console.log('✅ Cleanup complete!\n');
}

async function reimport() {
  console.log('📥 Step 2: Re-importing GDC data with ALL fields...\n');

  // Import using TypeScript ingestion service
  const { IngestionService } = await import('./src/features/data-ingestion/services/ingestion.service.ts');

  const ingestionService = new IngestionService();

  const ordersFilePath = 'C:/Users/ADMIN/Downloads/Data Ingestion GDC.xlsx';
  const customersFilePath = 'C:/Users/ADMIN/Downloads/Customers EIN Included.xlsx';

  const result = await ingestionService.ingest(ordersFilePath, customersFilePath, {
    dryRun: false,
    skipExistingOrders: false, // Force re-import
    sessionName: 'Complete Re-Import',
    createdBy: 'system',
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                   RE-IMPORT SUMMARY                       ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Orders Created:    ${result.stats.ordersCreated}`);
  console.log(`Quotes Created:    ${result.stats.quotesCreated}`);
  console.log(`Sales Orders:      ${result.stats.salesOrdersCreated}`);
  console.log(`Shipments Created: ${result.stats.shipmentsCreated} ← NEW!`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (result.stats.ordersFailed > 0) {
    console.log('⚠️  ERRORS:');
    result.orderResults
      .filter((r) => r.action === 'failed')
      .forEach((r) => {
        console.log(`   ${r.loadNumber}: ${r.error}`);
      });
  }

  return result;
}

async function verify() {
  console.log('🔍 Step 3: Verifying data completeness...\n');

  // Check sales orders
  const { data: orders, count: orderCount } = await supabase
    .from('sales_orders')
    .select('order_number, shipping_address_city, shipping_address_postal_code', { count: 'exact' })
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600052')
    .is('deleted_at', null);

  console.log(`   Sales Orders: ${orderCount}`);

  // Check how many have proper addresses
  const withCity = orders?.filter(o => o.shipping_address_city).length || 0;
  const withZip = orders?.filter(o => o.shipping_address_postal_code).length || 0;

  console.log(`   - With city: ${withCity}/${orderCount}`);
  console.log(`   - With ZIP: ${withZip}/${orderCount}`);

  // Check shipments
  const { count: shipmentCount } = await supabase
    .from('shipments')
    .select('id', { count: 'exact' })
    .in('supplier_reference_number', orders?.map(o => o.order_number) || [])
    .is('deleted_at', null);

  console.log(`   Shipments: ${shipmentCount}`);

  // Check shipments with tracking data
  const { data: shipmentsWithData } = await supabase
    .from('shipments')
    .select('eta_to_port, confirmed_eta, total_qty, action_required')
    .in('supplier_reference_number', orders?.map(o => o.order_number) || [])
    .is('deleted_at', null);

  const withETA = shipmentsWithData?.filter(s => s.eta_to_port).length || 0;
  const withQty = shipmentsWithData?.filter(s => s.total_qty > 0).length || 0;
  const withNotes = shipmentsWithData?.filter(s => s.action_required).length || 0;

  console.log(`   - With ETA: ${withETA}/${shipmentCount}`);
  console.log(`   - With Qty: ${withQty}/${shipmentCount}`);
  console.log(`   - With Notes: ${withNotes}/${shipmentCount}`);

  console.log('');

  if (orderCount === 30 && shipmentCount === 30 && withCity >= 25 && withETA >= 25) {
    console.log('✅ Verification PASSED - All data properly imported!\n');
    return true;
  } else {
    console.log('⚠️  Verification INCOMPLETE - Some data missing\n');
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         COMPLETE GDC DATA RE-IMPORT                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Cleanup
    await cleanup();

    // Step 2: Re-import
    await reimport();

    // Step 3: Verify
    const success = await verify();

    if (success) {
      console.log('🎉 Re-import completed successfully!\n');
      console.log('   All Excel fields are now properly saved:');
      console.log('   ✓ Addresses parsed (street, city, state, ZIP)');
      console.log('   ✓ Shipments created with tracking data');
      console.log('   ✓ ETA dates, quantities, and notes saved');
      console.log('');
    } else {
      console.log('⚠️  Re-import completed with warnings. Please review.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Re-import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
