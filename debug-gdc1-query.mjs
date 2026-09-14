import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugGDC1Query() {
  console.log('=== Testing GDC 1 Query (Exact Repository Logic) ===\n');

  const orderSeries = 'GDC 1';

  // Step 1: Query Purchase Orders
  const { data: purchaseOrders, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      po_date,
      expected_delivery_date,
      status,
      internal_notes,
      order_series,
      sales_order_id,
      created_at,
      sales_orders (
        id,
        order_number,
        customer_id,
        customer_po_number,
        eta_to_us_port,
        confirmed_eta,
        requested_delivery_date,
        actual_delivery_date,
        qty_delivered,
        outstanding_qty,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        grand_total,
        customers (id, name)
      )
    `)
    .is('deleted_at', null)
    .eq('order_series', orderSeries)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(3);

  if (poError) {
    console.error('PO Query Error:', poError);
    return;
  }

  console.log(`Found ${purchaseOrders?.length || 0} Purchase Orders\n`);

  purchaseOrders?.forEach(po => {
    console.log(`PO: ${po.po_number}`);
    console.log(`  ID: ${po.id}`);
    console.log(`  Status: ${po.status}`);
    console.log(`  SO: ${po.sales_orders?.order_number || 'None'}`);
  });

  // Step 2: Query PO Items
  const poIds = purchaseOrders?.map(po => po.id) || [];

  console.log(`\nQuerying items for PO IDs: ${poIds.join(', ')}`);

  const { data: poItems, error: itemsError } = await supabase
    .from('purchase_order_items')
    .select(`
      purchase_order_id,
      sku,
      description,
      quantity_ordered,
      unit_price,
      product_id,
      products(id, name, item_type)
    `)
    .in('purchase_order_id', poIds);

  if (itemsError) {
    console.error('Items Query Error:', itemsError);
    return;
  }

  console.log(`\nFound ${poItems?.length || 0} PO Items`);

  // Group by PO
  const itemsByPO = {};
  poItems?.forEach(item => {
    if (!itemsByPO[item.purchase_order_id]) {
      itemsByPO[item.purchase_order_id] = [];
    }
    itemsByPO[item.purchase_order_id].push(item);
  });

  console.log('\nItems by PO:');
  Object.keys(itemsByPO).forEach(poId => {
    const po = purchaseOrders?.find(p => p.id === poId);
    console.log(`  ${po?.po_number || poId}: ${itemsByPO[poId].length} items`);
    itemsByPO[poId].forEach(item => {
      console.log(`    - ${item.sku}: ${item.quantity_ordered}`);
    });
  });

  // Build SKU map
  const skuInfoMap = new Map();
  poItems?.forEach(item => {
    const productData = item.products;
    const productName = productData?.name || item.description || item.sku;

    if (item.sku && !skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }
  });

  console.log('\nUnique SKUs:');
  skuInfoMap.forEach((productName, sku) => {
    console.log(`  ${sku}: ${productName}`);
  });

  console.log(`\nTotal Unique SKUs: ${skuInfoMap.size}`);
}

debugGDC1Query().then(() => process.exit(0));
