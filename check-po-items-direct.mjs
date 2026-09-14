import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPOItems() {
  console.log('=== Checking PO Items (Direct Count) ===\n');

  // Count total PO items
  const { count: totalItems } = await supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact', head: true });

  console.log(`Total PO Items in database: ${totalItems}\n`);

  // Get sample items
  const { data: sampleItems } = await supabase
    .from('purchase_order_items')
    .select('id, purchase_order_id, sku, quantity_ordered, description')
    .limit(10);

  console.log('Sample PO Items:');
  sampleItems?.forEach((item, i) => {
    console.log(`${i + 1}. SKU: ${item.sku}, Qty: ${item.quantity_ordered}, PO: ${item.purchase_order_id}`);
  });

  // Check items for GDC 0 POs
  const { data: gdcPOs } = await supabase
    .from('purchase_orders')
    .select('id, po_number')
    .eq('order_series', 'GDC 0')
    .limit(5);

  console.log(`\n\nChecking items for ${gdcPOs?.length} GDC 0 POs:`);

  for (const po of gdcPOs || []) {
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('id, sku, quantity_ordered')
      .eq('purchase_order_id', po.id);

    console.log(`  ${po.po_number}: ${items?.length || 0} items`);
    items?.forEach(item => {
      console.log(`    - ${item.sku}: ${item.quantity_ordered}`);
    });
  }
}

checkPOItems().then(() => process.exit(0));
