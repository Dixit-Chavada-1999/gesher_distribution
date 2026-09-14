import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

async function fixMissingItems() {
  console.log('=== FIXING MISSING ORDER ITEMS ===\n');

  try {
    // Read parsed JSON
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));
    const allOrders = [...jsonData.gdc0, ...jsonData.gdc1];

    // Get products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, sku');

    if (prodError) {
      console.error('❌ Error fetching products:', prodError);
      return;
    }

    const product38 = products.find(p => p.sku === '290-85R38');
    const product24 = products.find(p => p.sku === '380-85R24');

    if (!product38 || !product24) {
      console.error('❌ Missing required products!');
      return;
    }

    // Get all sales orders
    const { data: salesOrders, error: soError } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        sales_order_items (
          id
        )
      `)
      .order('order_number', { ascending: true });

    if (soError) {
      console.error('❌ Error fetching sales orders:', soError);
      return;
    }

    let fixedCount = 0;

    // Fix each order with missing items
    for (const order of salesOrders) {
      const itemCount = order.sales_order_items?.length || 0;

      if (itemCount === 0) {
        console.log(`\n🔧 Fixing ${order.order_number}...`);

        const excelOrder = allOrders.find(o => o['Load #'] === order.order_number);

        if (!excelOrder) {
          console.log(`  ⚠️  Not found in Excel data`);
          continue;
        }

        const items = [];

        // Add 38" tire if quantity > 0
        const qty38 = excelOrder['SKU 290/85R38 CW Qty'] || 0;
        if (qty38 > 0) {
          items.push({
            sales_order_id: order.id,
            product_id: product38.id,
            sku: product38.sku,
            quantity: qty38,
            unit_price: excelOrder["38\" Price"] || 1120,
            tax_rate: 0,
          });
        }

        // Add 24" tire if quantity > 0
        const qty24 = excelOrder['SKU 380/85R24 CW Qty'] || 0;
        if (qty24 > 0) {
          items.push({
            sales_order_id: order.id,
            product_id: product24.id,
            sku: product24.sku,
            quantity: qty24,
            unit_price: excelOrder["24\" Price"] || 1080,
            tax_rate: 0,
          });
        }

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('sales_order_items')
            .insert(items);

          if (itemsError) {
            console.log(`  ❌ Error: ${itemsError.message}`);
          } else {
            console.log(`  ✅ Added ${items.length} items`);
            fixedCount++;
          }
        } else {
          console.log(`  ⚠️  No items to add`);
        }
      }
    }

    console.log('\n\n=== FIX COMPLETE ===');
    console.log(`✅ Fixed ${fixedCount} orders`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run fix
fixMissingItems();
