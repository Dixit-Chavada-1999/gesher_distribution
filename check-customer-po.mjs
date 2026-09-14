import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCustomerPO() {
  console.log('=== Checking Customer PO Numbers ===\n');

  // Check Sales Orders
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, customer_po_number, order_series')
    .in('order_series', ['GDC 0', 'GDC 1'])
    .order('order_number', { ascending: true })
    .limit(10);

  console.log('Sample Sales Orders:');
  salesOrders?.forEach(so => {
    console.log(`  ${so.order_number} (${so.order_series}): customer_po_number = "${so.customer_po_number}"`);
  });

  // Count how many have customer_po_number
  const { count: withPO } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .in('order_series', ['GDC 0', 'GDC 1'])
    .not('customer_po_number', 'is', null);

  const { count: total } = await supabase
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .in('order_series', ['GDC 0', 'GDC 1']);

  console.log(`\nTotal SOs: ${total}`);
  console.log(`With Customer PO: ${withPO}`);
  console.log(`Without Customer PO: ${total - withPO}`);
}

checkCustomerPO().then(() => process.exit(0));
