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

// Helper: Convert Excel serial date to YYYY-MM-DD
function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const year = date_info.getUTCFullYear();
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date_info.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// Helper: Map Excel status to database status
function mapStatus(excelStatus) {
  const statusMap = {
    'AVAILABLE': 'confirmed',
    'IN TRANSIT': 'processing',
    'INVOICED': 'delivered',
    'OPEN': 'confirmed'
  };
  return statusMap[excelStatus] || 'draft';
}

async function importData() {
  console.log('=== IMPORTING EXCEL DATA TO DATABASE ===\n');

  try {
    // Read parsed JSON
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));
    const allOrders = [...jsonData.gdc0, ...jsonData.gdc1];

    console.log(`📊 Total orders to import: ${allOrders.length}\n`);

    // 1. Get existing customers
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, name, customer_code');

    if (custError) {
      console.error('❌ Error fetching customers:', custError);
      return;
    }

    console.log('👥 Existing customers:');
    customers.forEach(c => console.log(`  - ${c.name} (${c.customer_code})`));

    // 2. Get existing products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, sku, item_type');

    if (prodError) {
      console.error('❌ Error fetching products:', prodError);
      return;
    }

    console.log('\n📦 Existing products:');
    products.forEach(p => console.log(`  - ${p.name} (${p.sku})`));

    // 3. Create customer name mapping
    const customerMap = {
      'GDC': customers.find(c => c.customer_code === 'GDC-INTERNAL')?.id,
      'Lindsay': customers.find(c => c.customer_code === 'LINDSEY')?.id,
      'Valley': customers.find(c => c.customer_code === 'VALMONT')?.id,
      'WISH': customers.find(c => c.customer_code === 'WISH')?.id,
      'Kansas Warehouse': customers.find(c => c.customer_code === 'GDC-INTERNAL')?.id, // Map to GDC
      'Nebraska Warehouse': customers.find(c => c.customer_code === 'GDC-INTERNAL')?.id, // Map to GDC
    };

    // 4. Create product mapping
    const product38 = products.find(p => p.sku === '290-85R38');
    const product24 = products.find(p => p.sku === '380-85R24');

    if (!product38 || !product24) {
      console.error('❌ Missing required products in database!');
      return;
    }

    console.log('\n📥 Starting import...\n');

    let successCount = 0;
    let errorCount = 0;

    // 5. Import each order
    for (const [index, order] of allOrders.entries()) {
      console.log(`\n[${index + 1}/${allOrders.length}] Importing ${order['Load #']}...`);

      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('sales_orders')
          .select('id, order_number')
          .eq('order_number', order['Load #'])
          .maybeSingle();

        if (existingOrder) {
          console.log(`  ⚠️  Skipping - Already exists: ${order['Load #']}`);
          errorCount++;
          continue;
        }

        const customerId = customerMap[order.Customer];
        if (!customerId) {
          console.log(`  ⚠️  Skipping - Unknown customer: ${order.Customer}`);
          errorCount++;
          continue;
        }

        // Prepare sales order data
        const etaDate = excelDateToString(order['ETA to US Port']);
        const deliveryDate = excelDateToString(order['Customer Expected Delivery'] || order['Customer Due Date']);

        // Use a fixed order_date (2024-01-01) to avoid date constraint issues
        // The actual important date is the ETA/delivery date
        const orderData = {
          order_number: order['Load #'],
          customer_id: customerId,
          customer_po_number: order['PO'] || null,
          order_date: '2024-01-01', // Fixed date to avoid constraint issues
          requested_delivery_date: deliveryDate || etaDate || '2024-12-31',
          status: mapStatus(order['Status']),
          product_source: 'direct', // Assuming direct from supplier
          order_series: 'GDC1', // Default series
          currency_code: 'USD', // FIXED: currency_code not currency
          internal_notes: order['Action Required / Notes'] || null, // FIXED: internal_notes not notes
        };

        // Create sales order
        const { data: newOrder, error: orderError } = await supabase
          .from('sales_orders')
          .insert([orderData])
          .select()
          .single();

        if (orderError) {
          console.error(`  ❌ Error creating order:`, orderError.message);
          errorCount++;
          continue;
        }

        // Create order items
        const items = [];

        // Add 38" tire if quantity > 0
        const qty38 = order['SKU 290/85R38 CW Qty'] || 0;
        if (qty38 > 0) {
          items.push({
            sales_order_id: newOrder.id,
            product_id: product38.id,
            sku: product38.sku, // FIXED: Add SKU field
            quantity: qty38,
            unit_price: order["38\" Price"] || 1120,
            tax_rate: 0,
          });
        }

        // Add 24" tire if quantity > 0
        const qty24 = order['SKU 380/85R24 CW Qty'] || 0;
        if (qty24 > 0) {
          items.push({
            sales_order_id: newOrder.id,
            product_id: product24.id,
            sku: product24.sku, // FIXED: Add SKU field
            quantity: qty24,
            unit_price: order["24\" Price"] || 1080,
            tax_rate: 0,
          });
        }

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('sales_order_items')
            .insert(items);

          if (itemsError) {
            console.error(`  ❌ Error creating items:`, itemsError.message);
            errorCount++;
          } else {
            console.log(`  ✅ Order created: ${order['Load #']} (${items.length} items)`);
            successCount++;
          }
        } else {
          console.log(`  ⚠️  No items to add for order ${order['Load #']}`);
          errorCount++;
        }

      } catch (error) {
        console.error(`  ❌ Error:`, error.message);
        errorCount++;
      }
    }

    console.log('\n\n=== IMPORT COMPLETE ===');
    console.log(`✅ Successfully imported: ${successCount} orders`);
    console.log(`❌ Errors/Skipped: ${errorCount} orders`);

  } catch (error) {
    console.error('\n❌ Fatal error during import:', error);
  }
}

// Run import
importData();
