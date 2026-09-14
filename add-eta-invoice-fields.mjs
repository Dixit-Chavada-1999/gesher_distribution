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

async function addETAAndInvoiceFields() {
  console.log('=== ADDING ETA & INVOICE FIELDS ===\n');
  console.log('Populating from Excel data:');
  console.log('  1. ETA to US Port');
  console.log('  2. Confirmed ETA');
  console.log('  3. Actual Delivery Date');
  console.log('  4. Qty Delivered');
  console.log('  5. Outstanding Qty');
  console.log('  6. Invoice Amount\n');

  try {
    // Read parsed JSON
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));
    const allOrders = [...jsonData.gdc0, ...jsonData.gdc1];

    console.log(`📊 Total orders: ${allOrders.length}\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [index, order] of allOrders.entries()) {
      const orderNumber = order['Load #'];

      console.log(`[${index + 1}/${allOrders.length}] ${orderNumber}...`);

      // Parse dates
      const etaToUsPort = excelDateToString(order['ETA to US Port']);
      const confirmedEta = excelDateToString(order['Confirmed ETA (shipping system)']);
      const actualDelivery = excelDateToString(order['Actual Delivery Date']);

      // Invoice amount (different field names for GDC0 vs GDC1)
      const invoiceAmount = order['Customer Invoice Amount'] || order['Invoice Amount'] || 0;

      // Convert to cents for storage
      const grandTotal = Math.round(invoiceAmount * 100);

      // Qty Delivered
      const qtyDelivered = order['Qty Delivered'] || 0;

      // Outstanding Qty
      const outstandingQty = order['Outstanding Qty for PO'] || order['Outstanding PO Qty'] || order['Total Qty'] || 0;

      // Prepare update data
      const updateData = {
        eta_to_us_port: etaToUsPort,
        confirmed_eta: confirmedEta,
        actual_delivery_date: actualDelivery,
        qty_delivered: qtyDelivered,
        outstanding_qty: outstandingQty,
        grand_total: grandTotal,
      };

      // Update sales order
      const { error } = await supabase
        .from('sales_orders')
        .update(updateData)
        .eq('order_number', orderNumber);

      if (error) {
        console.log(`  ❌ Error:`, error.message);
        errorCount++;
      } else {
        const details = [];
        if (etaToUsPort) details.push(`ETA: ${etaToUsPort}`);
        if (confirmedEta) details.push(`Conf: ${confirmedEta}`);
        if (invoiceAmount) details.push(`Inv: $${invoiceAmount.toLocaleString()}`);
        if (qtyDelivered) details.push(`Delivered: ${qtyDelivered}`);
        if (outstandingQty) details.push(`Outstanding: ${outstandingQty}`);

        console.log(`  ✅ ${details.join(', ')}`);
        successCount++;
      }
    }

    console.log('\n\n=== UPDATE COMPLETE ===');
    console.log(`✅ Successfully updated: ${successCount} orders`);
    console.log(`❌ Errors: ${errorCount} orders`);
    console.log('\nAll fields populated! ✅');
    console.log('Operations Dashboard will now show:');
    console.log('  - ETA to US Port ✅');
    console.log('  - Confirmed ETA ✅');
    console.log('  - Invoice Amount ✅');
    console.log('  - Actual Delivery Date ✅');
    console.log('  - Qty Delivered ✅');
    console.log('  - Outstanding Qty ✅');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run
addETAAndInvoiceFields();
