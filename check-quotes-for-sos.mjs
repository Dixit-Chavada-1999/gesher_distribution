import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkQuotes() {
  // Get all Sales Orders with GDC order series
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, order_series, quote_id')
    .is('deleted_at', null)
    .in('order_series', ['GDC 0', 'GDC 1'])
    .order('order_number', { ascending: true });

  console.log('=== Checking Quotes for Sales Orders ===\n');
  console.log(`Total Sales Orders: ${salesOrders?.length || 0}\n`);

  let withQuotes = 0;
  let withoutQuotes = 0;

  const sosWithoutQuotes = [];

  salesOrders?.forEach(so => {
    if (so.quote_id) {
      withQuotes++;
    } else {
      withoutQuotes++;
      sosWithoutQuotes.push(so);
      console.log(`✗ ${so.order_number} (${so.order_series}) - NO QUOTE`);
    }
  });

  console.log(`\n=== Summary ===`);
  console.log(`With Quotes: ${withQuotes}`);
  console.log(`Without Quotes: ${withoutQuotes}`);

  if (sosWithoutQuotes.length > 0) {
    console.log(`\n${withoutQuotes} Sales Orders need Quotes created!`);
  } else {
    console.log(`\n✓ All Sales Orders have Quotes!`);
  }
}

checkQuotes().then(() => process.exit(0));
