import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Parse address string into components
function parseAddress(addressString) {
  if (!addressString) return null;

  // Examples:
  // "1215 Oregon Street, Hiawatha, KS 66434"
  // "28800 Ida Street, Valley NE 68644"
  // "214 2nd Street, Lindsay, NE 68644"

  const parts = addressString.split(',').map(p => p.trim());

  if (parts.length < 2) {
    // Try to parse without commas
    // "28800 Ida Street Valley NE 68644"
    const match = addressString.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})$/);
    if (match) {
      const streetAndCity = match[1].trim();
      const state = match[2];
      const postal = match[3];

      // Try to split street and city
      const lastSpaceIndex = streetAndCity.lastIndexOf(' ');
      if (lastSpaceIndex > 0) {
        return {
          street: streetAndCity.substring(0, lastSpaceIndex).trim(),
          city: streetAndCity.substring(lastSpaceIndex + 1).trim(),
          state,
          postalCode: postal,
          country: 'US'
        };
      }

      return {
        street: streetAndCity,
        city: '',
        state,
        postalCode: postal,
        country: 'US'
      };
    }
    return null;
  }

  // Standard format: "street, city, state postal"
  const street = parts[0].trim();
  const city = parts[1].trim();

  // Last part should have state and postal code
  const lastPart = parts[parts.length - 1].trim();
  const statePostalMatch = lastPart.match(/([A-Z]{2})\s+(\d{5})/);

  if (statePostalMatch) {
    return {
      street,
      city,
      state: statePostalMatch[1],
      postalCode: statePostalMatch[2],
      country: 'US'
    };
  }

  // Fallback
  return {
    street,
    city,
    state: '',
    postalCode: '',
    country: 'US'
  };
}

async function addDeliveryAddresses() {
  console.log('=== ADDING DELIVERY ADDRESSES ===\n');
  console.log('Parsing addresses from Excel and updating Sales Orders...\n');

  try {
    // Read parsed JSON
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));
    const allOrders = [...jsonData.gdc0, ...jsonData.gdc1];

    console.log(`📊 Total orders: ${allOrders.length}\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, order] of allOrders.entries()) {
      const orderNumber = order['Load #'];
      const addressString = order['Delivery Address'];

      console.log(`[${index + 1}/${allOrders.length}] ${orderNumber}...`);

      if (!addressString) {
        console.log(`  ⚠️  No address in Excel`);
        errorCount++;
        continue;
      }

      // Parse address
      const address = parseAddress(addressString);

      if (!address) {
        console.log(`  ⚠️  Could not parse address: "${addressString}"`);
        errorCount++;
        continue;
      }

      // Update sales order
      const { error } = await supabase
        .from('sales_orders')
        .update({
          shipping_address_street: address.street || null,
          shipping_address_city: address.city || null,
          shipping_address_state: address.state || null,
          shipping_address_postal_code: address.postalCode || null,
          shipping_address_country: address.country || 'US',
        })
        .eq('order_number', orderNumber);

      if (error) {
        console.log(`  ❌ Error:`, error.message);
        errorCount++;
      } else {
        console.log(`  ✅ ${address.street}, ${address.city}, ${address.state} ${address.postalCode}`);
        successCount++;
      }
    }

    console.log('\n\n=== ADDRESS UPDATE COMPLETE ===');
    console.log(`✅ Successfully updated: ${successCount} orders`);
    console.log(`❌ Errors/Skipped: ${errorCount} orders`);
    console.log('\nDelivery addresses now visible in Operations Dashboard!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run
addDeliveryAddresses();
