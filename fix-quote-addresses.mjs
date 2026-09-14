#!/usr/bin/env node
/**
 * Fix quote addresses - Copy addresses from sales orders to quotes
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

async function fixQuoteAddresses() {
  console.log('📋 Fixing quote addresses from sales orders...\n');

  // Get all GDC quotes (QT2600023 - QT2600052)
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, customer_id')
    .gte('quote_number', 'QT2600023')
    .lte('quote_number', 'QT2600052')
    .is('deleted_at', null);

  if (!quotes || quotes.length === 0) {
    console.log('❌ No quotes found!');
    return;
  }

  console.log(`Found ${quotes.length} quotes\n`);

  let fixed = 0;
  let failed = 0;

  for (const quote of quotes) {
    // Get corresponding sales order
    const soNumber = quote.quote_number.replace('QT', 'SO');

    const { data: so } = await supabase
      .from('sales_orders')
      .select(`
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        shipping_address_country
      `)
      .eq('order_number', soNumber)
      .single();

    if (!so) {
      console.log(`  ⊘ ${quote.quote_number}: No matching sales order found`);
      failed++;
      continue;
    }

    // Update quote with addresses (both billing and shipping)
    const { error } = await supabase
      .from('quotes')
      .update({
        // Shipping address
        shipping_address_street: so.shipping_address_street,
        shipping_address_city: so.shipping_address_city,
        shipping_address_state: so.shipping_address_state,
        shipping_address_postal_code: so.shipping_address_postal_code,
        shipping_address_country: so.shipping_address_country || 'US',
        // Billing address (same as shipping)
        billing_address_street: so.shipping_address_street,
        billing_address_city: so.shipping_address_city,
        billing_address_state: so.shipping_address_state,
        billing_address_postal_code: so.shipping_address_postal_code,
        billing_address_country: so.shipping_address_country || 'US',
      })
      .eq('id', quote.id);

    if (error) {
      console.log(`  ✗ ${quote.quote_number}: ${error.message}`);
      failed++;
    } else {
      const address = so.shipping_address_city
        ? `${so.shipping_address_city}, ${so.shipping_address_state} ${so.shipping_address_postal_code}`
        : so.shipping_address_postal_code || '(no address)';
      console.log(`  ✓ ${quote.quote_number}: ${address}`);
      fixed++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log(`Quotes fixed:  ${fixed}`);
  console.log(`Failed:        ${failed}`);
  console.log('═══════════════════════════════════════\n');

  if (fixed > 0) {
    console.log('✅ Quote addresses fixed!\n');
    console.log('   હવે બધા quotes માં shipping અને billing addresses છે.');
    console.log('   Quotes page અને quote drawer માં addresses show થશે! 🎉\n');
  }
}

fixQuoteAddresses().catch(console.error);
