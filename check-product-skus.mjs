#!/usr/bin/env node
/**
 * Check what product SKUs exist in database
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

async function checkProductSKUs() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   PRODUCT SKUs IN DATABASE                                ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, unit_price')
    .is('deleted_at', null)
    .order('sku');

  console.log(`Total Products: ${products?.length || 0}\n`);

  if (products && products.length > 0) {
    console.log('SKU                | Product Name                          | Price');
    console.log('─'.repeat(80));

    products.forEach(p => {
      const price = p.unit_price ? `$${p.unit_price / 100}` : '(no price)';
      console.log(
        (p.sku || '(no sku)').padEnd(18) + ' | ' +
        (p.name || '(no name)').padEnd(37) + ' | ' +
        price
      );
    });

    console.log('─'.repeat(80));
    console.log('');

    // Check for tire products
    const tire38 = products.filter(p =>
      p.sku?.includes('290') || p.name?.includes('38')
    );
    const tire24 = products.filter(p =>
      p.sku?.includes('380') || p.name?.includes('24')
    );

    if (tire38.length > 0) {
      console.log('38" Tire Products:');
      tire38.forEach(p => {
        console.log(`  - ${p.sku}: ${p.name}`);
      });
      console.log('');
    } else {
      console.log('❌ No 38" tire products found!\n');
    }

    if (tire24.length > 0) {
      console.log('24" Tire Products:');
      tire24.forEach(p => {
        console.log(`  - ${p.sku}: ${p.name}`);
      });
      console.log('');
    } else {
      console.log('❌ No 24" tire products found!\n');
    }
  } else {
    console.log('❌ No products found in database!\n');
  }
}

checkProductSKUs().catch(console.error);
