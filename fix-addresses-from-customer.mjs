#!/usr/bin/env node
/**
 * Fix addresses using customer's default shipping address
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

async function fixAddresses() {
  console.log('🏠 Fixing addresses from customer default shipping address...\n');

  // Get all sales orders
  const { data: orders } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      customer_id,
      shipping_address_city,
      customers!inner (
        name,
        shipping_address_1,
        shipping_city,
        shipping_state,
        shipping_zip
      )
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600052')
    .is('deleted_at', null);

  console.log(`Found ${orders?.length || 0} orders\n`);

  let fixed = 0;
  let skipped = 0;

  for (const order of orders || []) {
    // If city already exists, skip
    if (order.shipping_address_city) {
      skipped++;
      console.log(`  ⊘ Skipped ${order.order_number}: Already has address`);
      continue;
    }

    const customer = order.customers;

    // Use customer's shipping address
    if (customer && (customer.shipping_city || customer.shipping_zip)) {
      const { error } = await supabase
        .from('sales_orders')
        .update({
          shipping_address_street: customer.shipping_address_1 || '',
          shipping_address_city: customer.shipping_city || '',
          shipping_address_state: customer.shipping_state || '',
          shipping_address_postal_code: customer.shipping_zip || '',
          shipping_address_country: 'US',
        })
        .eq('id', order.id);

      if (error) {
        console.log(`  ✗ Failed ${order.order_number}: ${error.message}`);
      } else {
        console.log(`  ✓ Fixed ${order.order_number}: ${customer.shipping_city}, ${customer.shipping_state} ${customer.shipping_zip}`);
        fixed++;
      }
    } else {
      console.log(`  ⊘ Skipped ${order.order_number}: Customer has no shipping address`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log(`Orders fixed:    ${fixed}`);
  console.log(`Orders skipped:  ${skipped}`);
  console.log('═══════════════════════════════════════\n');

  if (fixed > 0) {
    console.log('✅ Addresses fixed! Dashboard refresh કરો અને check કરો.\n');
  }
}

fixAddresses().catch(console.error);
