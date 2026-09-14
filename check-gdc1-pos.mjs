import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGDC1() {
  // Check GDC 1 Purchase Orders
  const { data: gdc1POs, error } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series, status, sales_order_id, sales_orders(order_number, customer_id, customers(name))')
    .is('deleted_at', null)
    .eq('order_series', 'GDC 1')
    .order('created_at', { ascending: true });

  console.log('=== GDC 1 Purchase Orders ===');
  console.log(`Total: ${gdc1POs?.length || 0}\n`);

  if (gdc1POs && gdc1POs.length > 0) {
    gdc1POs.forEach((po, index) => {
      const so = po.sales_orders;
      const customer = so?.customers?.name || 'Unknown';
      console.log(`${index + 1}. ${po.po_number} → ${so?.order_number || 'No SO'} (${customer}) - Status: ${po.status}`);
    });
  } else {
    console.log('No Purchase Orders found!');

    // Check if there are Sales Orders with GDC 1
    const { data: gdc1SOs } = await supabase
      .from('sales_orders')
      .select('order_number, order_series, product_source, status')
      .is('deleted_at', null)
      .eq('order_series', 'GDC 1')
      .eq('product_source', 'direct')
      .limit(10);

    console.log('\n=== Sales Orders with GDC 1 ===');
    console.log(`Total: ${gdc1SOs?.length || 0}`);
    if (gdc1SOs && gdc1SOs.length > 0) {
      gdc1SOs.forEach(so => {
        console.log(`- ${so.order_number}: status=${so.status}`);
      });
    }
  }

  if (error) {
    console.error('Error:', error);
  }
}

checkGDC1()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
