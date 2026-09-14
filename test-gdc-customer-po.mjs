import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGDCQuery() {
  console.log('=== Testing GDC 0 Query (Exact Repository Logic) ===\n');

  const orderSeries = 'GDC 0';

  // Step 1: Query Purchase Orders (exact same as repository)
  const { data: purchaseOrders, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      sales_order_id,
      order_series,
      sales_orders (
        id,
        order_number,
        customer_id,
        customer_po_number,
        customers (id, name)
      )
    `)
    .is('deleted_at', null)
    .eq('order_series', orderSeries)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5);

  if (poError) {
    console.error('PO Query Error:', poError);
    return;
  }

  console.log(`Found ${purchaseOrders?.length || 0} Purchase Orders\n`);

  purchaseOrders?.forEach((po, i) => {
    const linkedSO = Array.isArray(po.sales_orders) ? po.sales_orders[0] : po.sales_orders;
    console.log(`${i + 1}. PO: ${po.po_number}`);
    console.log(`   SO: ${linkedSO?.order_number || 'None'}`);
    console.log(`   Customer PO: ${linkedSO?.customer_po_number || 'NULL'}`);
    console.log(`   Customer: ${linkedSO?.customers?.name || 'None'}`);
    console.log('');
  });
}

testGDCQuery().then(() => process.exit(0));
