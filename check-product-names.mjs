import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductNames() {
  console.log('=== Checking Product Names ===\n');

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, item_type')
    .in('sku', ['290-85R38', '380-85R24']);

  console.log('Products in database:');
  products?.forEach(p => {
    console.log(`  SKU: ${p.sku}`);
    console.log(`  Name: ${p.name}`);
    console.log(`  Type: ${p.item_type}`);
    console.log('');
  });

  // Check PO items to see what product names are being used
  const { data: poItems } = await supabase
    .from('purchase_order_items')
    .select(`
      id,
      sku,
      description,
      product_id,
      products(id, name, sku)
    `)
    .limit(5);

  console.log('Sample PO Items with products:');
  poItems?.forEach((item, i) => {
    console.log(`${i + 1}. PO Item:`);
    console.log(`   SKU: ${item.sku}`);
    console.log(`   Description: ${item.description}`);
    console.log(`   Product Name: ${item.products?.name || 'NULL'}`);
    console.log('');
  });
}

checkProductNames().then(() => process.exit(0));
