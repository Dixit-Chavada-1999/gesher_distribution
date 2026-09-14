#!/usr/bin/env node
/**
 * Verify product prices
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function verifyProducts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('═══════════════════════════════════════');
  console.log('          PRODUCT PRICES                ');
  console.log('═══════════════════════════════════════\n');

  const { data: products } = await supabase
    .from('products')
    .select('sku, name, base_price, base_cost, status')
    .order('sku');

  if (products) {
    products.forEach(p => {
      const price = (p.base_price / 100).toFixed(2);
      const cost = (p.base_cost / 100).toFixed(2);
      const margin = p.base_price > 0 ? (((p.base_price - p.base_cost) / p.base_price) * 100).toFixed(1) : '0.0';

      console.log(`${p.sku.padEnd(20)} | ${p.name.padEnd(30)} | Price: $${price.padStart(8)} | Cost: $${cost.padStart(8)} | Margin: ${margin.padStart(5)}%`);
    });
  }

  console.log('\n✅ Product prices verified!\n');
}

verifyProducts().catch(console.error);
