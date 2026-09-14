#!/usr/bin/env node
/**
 * Add missing service products (Hours, Sales)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function addMissingServices() {
  console.log('📦 Adding missing service products...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const servicesToAdd = [
    {
      sku: 'HOURS',
      name: 'Hours',
      description: 'Hourly service charges',
      item_type: 'service',
      category: 'Services',
      base_price: 0, // Will be set per quote/order
      base_cost: 0,
    },
    {
      sku: 'SALES',
      name: 'Sales',
      description: 'Sales service',
      item_type: 'service',
      category: 'Services',
      base_price: 0,
      base_cost: 0,
    },
  ];

  let added = 0;
  let skipped = 0;

  for (const service of servicesToAdd) {
    // Check if exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, sku')
      .eq('sku', service.sku)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      console.log(`  ⊘ Skipped: ${service.sku} - ${service.name} (already exists)`);
      skipped++;
      continue;
    }

    // Add service
    const { error } = await supabase
      .from('products')
      .insert({
        ...service,
        status: 'active',
        is_sellable: true,
      });

    if (error) {
      console.log(`  ❌ Error adding ${service.sku}: ${error.message}`);
    } else {
      console.log(`  + Created: ${service.sku} - ${service.name}`);
      added++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('           SUMMARY                      ');
  console.log('═══════════════════════════════════════');
  console.log(`Services added:    ${added}`);
  console.log(`Services skipped:  ${skipped}`);
  console.log('═══════════════════════════════════════\n');

  // Show final product list
  const { data: products, count } = await supabase
    .from('products')
    .select('sku, name, item_type, category, base_price', { count: 'exact' })
    .is('deleted_at', null)
    .order('item_type', { ascending: false })
    .order('sku');

  console.log('═══════════════════════════════════════');
  console.log('      FINAL PRODUCT LIST                ');
  console.log('═══════════════════════════════════════');
  console.log(`Total: ${count} products\n`);

  let currentType = null;
  products?.forEach(p => {
    if (p.item_type !== currentType) {
      currentType = p.item_type;
      const typeLabel = currentType === 'service' ? 'SERVICES' :
                       currentType === 'inventory' ? 'INVENTORY' : 'NON-INVENTORY';
      console.log(`\n${typeLabel}:`);
    }
    const price = (p.base_price / 100).toFixed(2);
    console.log(`  ${p.sku.padEnd(20)} ${p.name.padEnd(40)} $${price.padStart(8)}`);
  });

  console.log('\n═══════════════════════════════════════\n');
  console.log('✅ All products ready!\n');
}

addMissingServices().catch(console.error);
