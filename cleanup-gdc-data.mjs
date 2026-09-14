import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupGDCData() {
  console.log('=== Cleaning Up GDC Data ===\n');

  // Step 1: Get all Sales Orders with GDC order series
  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select('id, order_number, order_series, quote_id')
    .is('deleted_at', null)
    .in('order_series', ['GDC 0', 'GDC 1']);

  console.log(`Found ${salesOrders?.length || 0} Sales Orders to delete\n`);

  const soIds = salesOrders?.map(so => so.id) || [];
  const quoteIds = salesOrders?.map(so => so.quote_id).filter(Boolean) || [];

  // Step 2: Delete Purchase Order Items
  if (soIds.length > 0) {
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id')
      .in('sales_order_id', soIds);

    const poIds = pos?.map(po => po.id) || [];

    if (poIds.length > 0) {
      const { error: poItemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .in('purchase_order_id', poIds);

      if (poItemsError) {
        console.error('Error deleting PO items:', poItemsError);
      } else {
        console.log(`✓ Deleted Purchase Order Items for ${poIds.length} POs`);
      }
    }

    // Step 3: Delete Purchase Orders
    const { error: posError } = await supabase
      .from('purchase_orders')
      .delete()
      .in('sales_order_id', soIds);

    if (posError) {
      console.error('Error deleting Purchase Orders:', posError);
    } else {
      console.log(`✓ Deleted ${poIds.length} Purchase Orders`);
    }
  }

  // Step 4: Delete Sales Order Items
  if (soIds.length > 0) {
    const { error: soItemsError } = await supabase
      .from('sales_order_items')
      .delete()
      .in('sales_order_id', soIds);

    if (soItemsError) {
      console.error('Error deleting SO items:', soItemsError);
    } else {
      console.log(`✓ Deleted Sales Order Items`);
    }
  }

  // Step 5: Delete Sales Orders
  if (soIds.length > 0) {
    const { error: sosError } = await supabase
      .from('sales_orders')
      .delete()
      .in('id', soIds);

    if (sosError) {
      console.error('Error deleting Sales Orders:', sosError);
    } else {
      console.log(`✓ Deleted ${soIds.length} Sales Orders`);
    }
  }

  // Step 6: Delete Quote Items
  if (quoteIds.length > 0) {
    const { error: quoteItemsError } = await supabase
      .from('quote_items')
      .delete()
      .in('quote_id', quoteIds);

    if (quoteItemsError) {
      console.error('Error deleting Quote items:', quoteItemsError);
    } else {
      console.log(`✓ Deleted Quote Items`);
    }
  }

  // Step 7: Delete Quotes
  if (quoteIds.length > 0) {
    const { error: quotesError } = await supabase
      .from('quotes')
      .delete()
      .in('id', quoteIds);

    if (quotesError) {
      console.error('Error deleting Quotes:', quotesError);
    } else {
      console.log(`✓ Deleted ${quoteIds.length} Quotes`);
    }
  }

  console.log('\n✅ Cleanup Complete!');
}

cleanupGDCData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Cleanup Failed:', err);
    process.exit(1);
  });
