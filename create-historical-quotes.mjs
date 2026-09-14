import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createHistoricalQuotes() {
  console.log('=== CREATING HISTORICAL QUOTES ===\n');
  console.log('Creating quotes for all 31 sales orders to maintain proper flow:\n');
  console.log('Quote → Sales Order → Purchase Order\n');

  try {
    // Get all sales orders with items
    const { data: salesOrders, error: soError } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_id,
        customer_po_number,
        order_date,
        requested_delivery_date,
        status,
        product_source,
        order_series,
        currency_code,
        internal_notes,
        sales_order_items (
          id,
          product_id,
          sku,
          quantity,
          unit_price,
          tax_rate
        )
      `)
      .order('order_number', { ascending: true });

    if (soError) {
      console.error('❌ Error fetching sales orders:', soError);
      return;
    }

    console.log(`📋 Found ${salesOrders.length} sales orders\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, order] of salesOrders.entries()) {
      console.log(`[${index + 1}/${salesOrders.length}] Creating quote for ${order.order_number}...`);

      try {
        // Create quote number from SO number (SO2600023 → QT2600023)
        const quoteNumber = order.order_number.replace('SO', 'QT');

        // Check if quote already exists
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('id, quote_number')
          .eq('quote_number', quoteNumber)
          .maybeSingle();

        if (existingQuote) {
          console.log(`  ⚠️  Quote already exists: ${quoteNumber}`);
          errorCount++;
          continue;
        }

        // Create quote
        const quoteData = {
          quote_number: quoteNumber,
          customer_id: order.customer_id,
          quote_date: order.order_date,
          valid_until: order.requested_delivery_date,
          status: 'converted', // Historical quotes are already converted
          product_source: order.product_source,
          currency_code: order.currency_code,
          internal_notes: order.internal_notes,
          converted_to_sales_order_id: order.id, // Link to SO
          converted_at: new Date().toISOString(), // Mark as converted
        };

        const { data: newQuote, error: quoteError } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();

        if (quoteError) {
          console.error(`  ❌ Error creating quote:`, quoteError.message);
          errorCount++;
          continue;
        }

        // Create quote items from SO items
        const quoteItems = order.sales_order_items.map(item => ({
          quote_id: newQuote.id,
          product_id: item.product_id,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems);

        if (itemsError) {
          console.error(`  ❌ Error creating quote items:`, itemsError.message);
          errorCount++;
          continue;
        }

        // Link quote to sales order
        const { error: updateError } = await supabase
          .from('sales_orders')
          .update({ quote_id: newQuote.id })
          .eq('id', order.id);

        if (updateError) {
          console.error(`  ❌ Error linking quote to SO:`, updateError.message);
          errorCount++;
          continue;
        }

        console.log(`  ✅ Quote created: ${quoteNumber} (${quoteItems.length} items) → Linked to ${order.order_number}`);
        successCount++;

      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        errorCount++;
      }
    }

    console.log('\n\n=== QUOTE CREATION COMPLETE ===');
    console.log(`✅ Successfully created: ${successCount} quotes`);
    console.log(`❌ Errors/Skipped: ${errorCount} quotes`);
    console.log('\nFlow now complete:');
    console.log('  Quote (converted) → Sales Order → Purchase Order (pending)');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run
createHistoricalQuotes();
