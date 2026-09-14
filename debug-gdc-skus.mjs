import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugGDCSKUs() {
  console.log('=== Debugging GDC SKU Columns ===\n');

  const orderSeries = 'GDC 0';

  // Step 1: Get Purchase Orders
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series')
    .is('deleted_at', null)
    .eq('order_series', orderSeries)
    .limit(3);

  console.log(`Found ${purchaseOrders?.length || 0} POs for ${orderSeries}\n`);

  const poIds = purchaseOrders?.map(po => po.id) || [];

  // Step 2: Get PO Items
  const { data: poItems } = await supabase
    .from('purchase_order_items')
    .select(`
      purchase_order_id,
      sku,
      description,
      quantity_ordered,
      product_id,
      products(id, name, item_type)
    `)
    .in('purchase_order_id', poIds);

  console.log(`Found ${poItems?.length || 0} PO Items\n`);

  // Group by PO
  const itemsByPO = {};
  poItems?.forEach(item => {
    if (!itemsByPO[item.purchase_order_id]) {
      itemsByPO[item.purchase_order_id] = [];
    }
    itemsByPO[item.purchase_order_id].push(item);
  });

  console.log('Items by PO:');
  purchaseOrders?.forEach(po => {
    const items = itemsByPO[po.id] || [];
    console.log(`\n${po.po_number}:`);
    if (items.length === 0) {
      console.log('  ⚠️  NO ITEMS FOUND!');
    } else {
      items.forEach(item => {
        console.log(`  - SKU: ${item.sku}, Qty: ${item.quantity_ordered}, Product: ${item.products?.name || 'N/A'}`);
      });
    }
  });

  // Check unique SKUs
  const skuSet = new Set();
  poItems?.forEach(item => {
    if (item.sku) {
      skuSet.add(item.sku);
    }
  });

  console.log(`\n\nUnique SKUs found: ${skuSet.size}`);
  skuSet.forEach(sku => console.log(`  - ${sku}`));
}

debugGDCSKUs().then(() => process.exit(0));
