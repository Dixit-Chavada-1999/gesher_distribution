import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from('products')
    .select('id, sku, name')
    .in('sku', ['290/85R38', '380/85R24']);

  console.log('Products in database:', data?.length || 0);
  data?.forEach(p => console.log(`- ${p.sku}: ${p.name}`));

  // Also check all products
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, sku, name')
    .limit(10);

  console.log('\nAll products (first 10):');
  allProducts?.forEach(p => console.log(`- ${p.sku}: ${p.name}`));
}

check().then(() => process.exit(0));
