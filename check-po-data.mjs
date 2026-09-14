import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load from .env file (not .env.local - that's where Supabase creds are)
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPOs() {
  // Check total POs
  const { data: allPOs, error: err1 } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series, status, sales_order_id, deleted_at')
    .is('deleted_at', null)
    .limit(10);

  console.log('=== All Purchase Orders (first 10) ===');
  console.log('Total found:', allPOs?.length || 0);
  if (allPOs && allPOs.length > 0) {
    allPOs.forEach(po => {
      console.log(`- ${po.po_number}: order_series='${po.order_series}', status=${po.status}, has_SO=${!!po.sales_order_id}`);
    });
  } else {
    console.log('No Purchase Orders found!');
  }

  // Check GDC 0 and GDC 1
  const { data: gdc0, error: err2 } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series')
    .is('deleted_at', null)
    .eq('order_series', 'GDC 0');

  const { data: gdc1, error: err3 } = await supabase
    .from('purchase_orders')
    .select('id, po_number, order_series')
    .is('deleted_at', null)
    .eq('order_series', 'GDC 1');

  console.log("\n=== By Order Series ===");
  console.log(`GDC 0: ${gdc0?.length || 0} POs`);
  console.log(`GDC 1: ${gdc1?.length || 0} POs`);

  // Check Sales Orders with order_series
  const { data: sos, error: err4 } = await supabase
    .from('sales_orders')
    .select('id, order_number, order_series, customer_po_number, product_source, status')
    .is('deleted_at', null)
    .in('order_series', ['GDC 0', 'GDC 1'])
    .limit(10);

  console.log("\n=== Sales Orders with GDC order_series ===");
  console.log('Total found:', sos?.length || 0);
  if (sos && sos.length > 0) {
    sos.forEach(so => {
      console.log(`- ${so.order_number}: order_series='${so.order_series}', product_source='${so.product_source}', status=${so.status}, customer_po=${so.customer_po_number}`);
    });
  }
}

checkPOs().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
