#!/usr/bin/env node
/**
 * Clean up duplicate products
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate products...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Delete GDC-COMMISSION (keep COMMISSION-SERVICE which is used in orders)
  console.log('Deleting duplicate commission product (GDC-COMMISSION)...');

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('sku', 'GDC-COMMISSION');

  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
  } else {
    console.log(`  ✓ Deleted GDC-COMMISSION (duplicate)`);
  }

  // Verify final count
  const { data: products, count } = await supabase
    .from('products')
    .select('sku, name, item_type', { count: 'exact' })
    .is('deleted_at', null)
    .order('sku');

  console.log('\n═══════════════════════════════════════');
  console.log('      FINAL PRODUCT LIST                ');
  console.log('═══════════════════════════════════════');
  console.log(`Total: ${count} products\n`);

  products?.forEach(p => {
    const type = p.item_type === 'inventory' ? 'INV' : p.item_type === 'service' ? 'SVC' : 'NON-INV';
    console.log(`  [${type.padEnd(7)}] ${p.sku.padEnd(20)} ${p.name}`);
  });

  console.log('═══════════════════════════════════════\n');
  console.log('✅ Cleanup complete!\n');
}

cleanupDuplicates().catch(console.error);
