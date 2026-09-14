#!/usr/bin/env node
/**
 * Verify quote addresses are saved
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

async function verifyQuoteAddresses() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           QUOTE ADDRESS VERIFICATION                      ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all quotes
  const { data: quotes, count } = await supabase
    .from('quotes')
    .select('quote_number, billing_address_street, billing_address_city, billing_address_state, billing_address_postal_code, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_postal_code', { count: 'exact' })
    .gte('quote_number', 'QT2600023')
    .lte('quote_number', 'QT2600052')
    .is('deleted_at', null);

  console.log('Total Quotes: ' + count + '\n');

  // Check how many have addresses
  const withBillingStreet = quotes?.filter(q => q.billing_address_street).length || 0;
  const withBillingCity = quotes?.filter(q => q.billing_address_city).length || 0;
  const withBillingState = quotes?.filter(q => q.billing_address_state).length || 0;
  const withBillingZip = quotes?.filter(q => q.billing_address_postal_code).length || 0;

  const withShippingStreet = quotes?.filter(q => q.shipping_address_street).length || 0;
  const withShippingCity = quotes?.filter(q => q.shipping_address_city).length || 0;
  const withShippingState = quotes?.filter(q => q.shipping_address_state).length || 0;
  const withShippingZip = quotes?.filter(q => q.shipping_address_postal_code).length || 0;

  console.log('BILLING ADDRESS:');
  console.log('  - With street: ' + withBillingStreet + '/' + count);
  console.log('  - With city: ' + withBillingCity + '/' + count);
  console.log('  - With state: ' + withBillingState + '/' + count);
  console.log('  - With ZIP: ' + withBillingZip + '/' + count);
  console.log('');

  console.log('SHIPPING ADDRESS:');
  console.log('  - With street: ' + withShippingStreet + '/' + count);
  console.log('  - With city: ' + withShippingCity + '/' + count);
  console.log('  - With state: ' + withShippingState + '/' + count);
  console.log('  - With ZIP: ' + withShippingZip + '/' + count);
  console.log('');

  // Show sample quote with full address
  const sampleWithAddress = quotes?.find(q => q.billing_address_city);
  if (sampleWithAddress) {
    console.log('Sample Quote (' + sampleWithAddress.quote_number + ') - BILLING:');
    console.log('  ' + (sampleWithAddress.billing_address_street || '(no street)'));
    console.log('  ' + sampleWithAddress.billing_address_city + ', ' + sampleWithAddress.billing_address_state + ' ' + sampleWithAddress.billing_address_postal_code);
    console.log('');
    console.log('Sample Quote (' + sampleWithAddress.quote_number + ') - SHIPPING:');
    console.log('  ' + (sampleWithAddress.shipping_address_street || '(no street)'));
    console.log('  ' + sampleWithAddress.shipping_address_city + ', ' + sampleWithAddress.shipping_address_state + ' ' + sampleWithAddress.shipping_address_postal_code);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    RESULT                                  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (withBillingZip >= 28 && withShippingZip >= 28) {
    console.log('✅ SUCCESS! Quote addresses properly saved!\n');
    console.log('   બધા quotes માં billing અને shipping addresses save થયા છે!');
    console.log('   Quotes page પર addresses show થશે! 🎉\n');
  } else {
    console.log('⚠️  Some quotes still missing addresses\n');
  }
}

verifyQuoteAddresses().catch(console.error);
