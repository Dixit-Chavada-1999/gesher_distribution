#!/usr/bin/env node
/**
 * Database cleanup script - delete all transactional data
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function runCleanup() {
  console.log('🧹 Starting database cleanup...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const tablesToClean = [
    // Transactional data (order matters for foreign keys)
    'invoice_payments',
    'invoice_items',
    'invoices',
    'credit_note_items',
    'credit_notes',
    'packing_list_items',
    'packing_lists',
    'pick_ticket_items',
    'pick_tickets',
    'shipment_status_history',
    'shipment_items',
    'shipments',
    'shipping_emails',
    'inventory_movements',
    'inventory',
    'sales_order_items',
    'sales_orders',
    'purchase_order_items',
    'purchase_orders',
    'quote_items',
    'quotes',
    'cost_components',
    'price_matrix',
    'inbound_email_attachments',
    'inbound_emails',
    'po_extractions',
    'attachments',
    // Master data
    'products',
    'customer_contacts',
    'customers',
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const table of tablesToClean) {
    try {
      const { error, count } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.log(`❌ Error cleaning ${table}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✓ Cleaned ${table}`);
        successCount++;
      }
    } catch (err) {
      console.log(`⚠️  Skipped ${table}: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('           CLEANUP SUMMARY              ');
  console.log('═══════════════════════════════════════');
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════\n');

  // Verify cleanup
  console.log('🔍 Verifying cleanup...\n');

  const verifyTables = [
    'customers',
    'products',
    'quotes',
    'sales_orders',
    'purchase_orders',
    'invoices',
    'shipments'
  ];

  for (const table of verifyTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error) {
      console.log(`   ${table}: ${count || 0} records`);
    }
  }

  console.log('\n✅ Database cleanup complete!\n');
}

runCleanup().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
