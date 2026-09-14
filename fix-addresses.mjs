#!/usr/bin/env node
/**
 * Fix addresses - Parse delivery addresses properly
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

// Address parser function
function parseAddress(fullAddress) {
  if (!fullAddress || fullAddress.trim() === '') {
    return { street: '', city: '', state: '', postalCode: '', country: 'US' };
  }

  try {
    let cleaned = fullAddress.trim();

    // Extract ZIP code (5 or 9 digits at end)
    const zipMatch = cleaned.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    const postalCode = zipMatch ? zipMatch[1] : '';
    if (zipMatch) {
      cleaned = cleaned.replace(zipMatch[0], '').trim();
    }

    // Extract state (2 letter code before ZIP)
    const stateMatch = cleaned.match(/\b([A-Z]{2})\s*,?\s*$/);
    const state = stateMatch ? stateMatch[1] : '';
    if (stateMatch) {
      cleaned = cleaned.replace(stateMatch[0], '').trim();
    }

    // Remove trailing comma
    cleaned = cleaned.replace(/,\s*$/, '').trim();

    // Split into street and city
    let street = '';
    let city = '';

    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      street = parts[0].trim();
      city = parts.slice(1).join(',').trim();
    } else {
      // No comma - try to split by last word (city)
      const words = cleaned.split(/\s+/);
      if (words.length >= 2) {
        city = words[words.length - 1];
        street = words.slice(0, -1).join(' ');
      } else {
        street = cleaned;
      }
    }

    return {
      street: street || '',
      city: city || '',
      state: state || '',
      postalCode: postalCode || '',
      country: 'US',
    };
  } catch (error) {
    console.warn(`⚠️  Failed to parse: "${fullAddress}"`);
    return {
      street: fullAddress,
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    };
  }
}

async function fixAddresses() {
  console.log('🏠 Fixing addresses...\n');

  // Get all sales orders with addresses
  const { data: orders } = await supabase
    .from('sales_orders')
    .select('id, order_number, shipping_address_street, shipping_address_city')
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600052')
    .is('deleted_at', null);

  console.log(`Found ${orders?.length || 0} orders to fix\n`);

  let fixed = 0;
  let skipped = 0;

  for (const order of orders || []) {
    // If city already exists, skip
    if (order.shipping_address_city) {
      skipped++;
      continue;
    }

    // Parse the address from street field (which has full address or just ZIP)
    const fullAddress = order.shipping_address_street;
    const parsed = parseAddress(fullAddress);

    // Update only if we got at least city
    if (parsed.city || parsed.state) {
      const { error } = await supabase
        .from('sales_orders')
        .update({
          shipping_address_street: parsed.street || fullAddress,
          shipping_address_city: parsed.city,
          shipping_address_state: parsed.state,
          shipping_address_postal_code: parsed.postalCode || fullAddress, // Use ZIP if we got it
        })
        .eq('id', order.id);

      if (error) {
        console.log(`  ✗ Failed ${order.order_number}: ${error.message}`);
      } else {
        console.log(`  ✓ Fixed ${order.order_number}: ${parsed.city}, ${parsed.state} ${parsed.postalCode}`);
        fixed++;
      }
    } else {
      console.log(`  ⊘ Skipped ${order.order_number}: Could not parse "${fullAddress}"`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('            SUMMARY                     ');
  console.log('═══════════════════════════════════════');
  console.log(`Orders fixed:    ${fixed}`);
  console.log(`Orders skipped:  ${skipped}`);
  console.log('═══════════════════════════════════════\n');
}

fixAddresses().catch(console.error);
