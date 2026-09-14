import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPOItems() {
  console.log('=== Checking Purchase Order Items ===\n');

  // Get GDC 0 POs
  const { data: gdc0POs } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series')
    .is('deleted_at', null)
    .eq('order_series', 'GDC 0')
    .limit(3);

  console.log('GDC 0 Sample POs:');
  for (const po of gdc0POs || []) {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('id, sku, quantity_ordered')
      .eq('purchase_order_id', po.id);

    console.log(`  ${po.po_number}: ${items?.length || 0} items`);
    items?.forEach(item => {
      console.log(`    - ${item.sku}: ${item.quantity_ordered}`);
    });
  }

  // Get GDC 1 POs
  const { data: gdc1POs } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series')
    .is('deleted_at', null)
    .eq('order_series', 'GDC 1')
    .limit(3);

  console.log('\nGDC 1 Sample POs:');
  for (const po of gdc1POs || []) {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('id, sku, quantity_ordered')
      .eq('purchase_order_id', po.id);

    console.log(`  ${po.po_number}: ${items?.length || 0} items`);
    items?.forEach(item => {
      console.log(`    - ${item.sku}: ${item.quantity_ordered}`);
    });
  }

  // Count total items
  const { data: gdc0ItemsCount } = await supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact', head: true })
    .in('purchase_order_id', (gdc0POs || []).map(p => p.id));

  const { data: gdc1ItemsCount } = await supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact', head: true })
    .in('purchase_order_id', (gdc1POs || []).map(p => p.id));

  console.log('\n=== Summary ===');
  console.log(`GDC 0: ${gdc0POs?.length || 0} POs checked`);
  console.log(`GDC 1: ${gdc1POs?.length || 0} POs checked`);
}

checkPOItems().then(() => process.exit(0));
