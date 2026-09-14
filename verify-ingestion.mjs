#!/usr/bin/env node
/**
 * Verify GDC data ingestion results
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

async function verifyIngestion() {
  console.log('🔍 Verifying GDC data ingestion...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Check counts
  console.log('═══════════════════════════════════════');
  console.log('              RECORD COUNTS             ');
  console.log('═══════════════════════════════════════');

  const tables = ['customers', 'products', 'quotes', 'sales_orders', 'quote_items', 'sales_order_items'];

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    console.log(`${table.padEnd(20)}: ${count}`);
  }

  // 2. Check quote conversions
  console.log('\n═══════════════════════════════════════');
  console.log('           QUOTE CONVERSIONS            ');
  console.log('═══════════════════════════════════════');

  const { count: convertedCount } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'converted')
    .not('converted_to_sales_order_id', 'is', null);

  console.log(`Converted quotes: ${convertedCount}`);

  // 3. Check order series
  console.log('\n═══════════════════════════════════════');
  console.log('            ORDER SERIES                ');
  console.log('═══════════════════════════════════════');

  const { data: gdc0 } = await supabase
    .from('sales_orders')
    .select('order_number', { count: 'exact' })
    .eq('order_series', 'GDC 0');

  const { data: gdc1 } = await supabase
    .from('sales_orders')
    .select('order_number', { count: 'exact' })
    .eq('order_series', 'GDC 1');

  console.log(`GDC 0: ${gdc0?.length || 0} orders`);
  console.log(`GDC 1: ${gdc1?.length || 0} orders`);

  // 4. Sample orders
  console.log('\n═══════════════════════════════════════');
  console.log('            SAMPLE ORDERS               ');
  console.log('═══════════════════════════════════════');

  const { data: sampleOrders } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      order_series,
      status,
      grand_total,
      customers!inner(name)
    `)
    .order('order_number')
    .limit(5);

  if (sampleOrders) {
    sampleOrders.forEach(order => {
      console.log(`${order.order_number} | ${order.order_series} | ${order.customers.name} | $${(order.grand_total / 100).toFixed(2)} | ${order.status}`);
    });
  }

  // 5. Check quote → SO links
  console.log('\n═══════════════════════════════════════');
  console.log('          QUOTE → SO LINKS              ');
  console.log('═══════════════════════════════════════');

  const { data: linkedOrders } = await supabase
    .from('quotes')
    .select(`
      quote_number,
      status,
      sales_orders!quotes_converted_to_sales_order_id_fkey(order_number)
    `)
    .eq('status', 'converted')
    .limit(5);

  if (linkedOrders) {
    linkedOrders.forEach(quote => {
      console.log(`${quote.quote_number} → ${quote.sales_orders?.order_number || 'N/A'}`);
    });
  }

  console.log('\n✅ Verification complete!\n');
}

verifyIngestion().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
