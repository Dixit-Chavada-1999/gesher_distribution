import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const filePath = 'D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx';

// Helper to convert Excel date number to ISO date
function excelDateToISO(excelDate) {
  if (!excelDate || typeof excelDate !== 'number') return null;
  const date = XLSX.SSF.parse_date_code(excelDate);
  if (!date) return null;
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
}

// Get system user
async function getSystemUser() {
  const { data } = await supabase
    .from('users')
    .select('id, email')
    .limit(1)
    .single();
  return data;
}

// Get or create customer
async function getOrCreateCustomer(customerName) {
  if (!customerName || customerName === 'GDC' || customerName === 'Gesher') {
    // Return Gesher as customer
    const { data } = await supabase
      .from('customers')
      .select('id')
      .ilike('name', 'Gesher%')
      .limit(1)
      .single();

    if (data) return data.id;

    // Create Gesher customer
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        name: 'Gesher Distribution',
        channel: 'oem',
        status: 'active',
      })
      .select('id')
      .single();

    return newCustomer?.id;
  }

  // Check if customer exists
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', customerName)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new customer
  const { data: newCustomer } = await supabase
    .from('customers')
    .insert({
      name: customerName,
      channel: 'oem',
      status: 'active',
    })
    .select('id')
    .single();

  return newCustomer?.id;
}

// Get products (tires)
async function getProducts() {
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name')
    .in('sku', ['290-85R38', '380-85R24']); // Database uses dashes, not slashes

  const productMap = {};
  products?.forEach(p => {
    // Map both dash and slash versions to same product
    productMap[p.sku] = p;
    productMap[p.sku.replace('-', '/')] = p; // Also map slash version
  });

  return productMap;
}

// Get supplier (Galileo)
async function getSupplier() {
  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .ilike('name', '%Galileo%')
    .limit(1)
    .maybeSingle();

  if (data) return data;

  // Create Galileo supplier if not exists
  const { data: newSupplier } = await supabase
    .from('suppliers')
    .insert({
      name: 'Galileo Manufacturing',
      status: 'active',
    })
    .select('id, name')
    .single();

  return newSupplier;
}

async function importData() {
  console.log('=== Starting GDC Data Import ===\n');

  const systemUser = await getSystemUser();
  console.log(`System User: ${systemUser.email} (${systemUser.id})\n`);

  const productMap = await getProducts();
  console.log('Products loaded:', Object.keys(productMap).join(', '));

  const supplier = await getSupplier();
  console.log(`Supplier: ${supplier.name} (${supplier.id})\n`);

  const workbook = XLSX.readFile(filePath);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Sheet: ${sheetName}`);
    console.log('='.repeat(60));

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    // Skip first 2 rows (title and headers), start from row 3
    const dataRows = rawData.slice(2);

    console.log(`Total rows to process: ${dataRows.length}\n`);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      totalProcessed++;

      // Extract data based on sheet
      let soNumber, qty38, qty24, customerName, customerPO, etaPort, deliveryAddr, status, notes;
      let price38, price24, invoiceAmt;

      if (sheetName === 'GDC 0') {
        soNumber = row['__EMPTY'];
        qty38 = row['__EMPTY_1'] || 0;
        qty24 = row['__EMPTY_2'] || 0;
        customerName = row['__EMPTY_4'];
        customerPO = row['__EMPTY_5'];
        etaPort = row['__EMPTY_6'];
        deliveryAddr = row['__EMPTY_7'];
        status = row['__EMPTY_16'];
        notes = row['__EMPTY_17'];
        price38 = row['__EMPTY_14'];
        price24 = row['__EMPTY_15'];
        invoiceAmt = row['__EMPTY_13'];
      } else {
        // GDC 1
        soNumber = row['__EMPTY_1'];
        qty38 = row['__EMPTY_2'] || 0;
        qty24 = row['__EMPTY_3'] || 0;
        customerName = row['__EMPTY_5'];
        customerPO = row['__EMPTY_6'];
        etaPort = row['__EMPTY_8'];
        deliveryAddr = row['__EMPTY_7'];
        status = row['__EMPTY_15'];
        notes = row['__EMPTY_16'];
        price38 = row['__EMPTY_13'];
        price24 = row['__EMPTY_14'];
        invoiceAmt = row['__EMPTY_12'];
      }

      if (!soNumber) {
        console.log(`Row ${i + 1}: Skipped - No SO number`);
        totalSkipped++;
        continue;
      }

      console.log(`\nRow ${i + 1}: ${soNumber} (${sheetName})`);
      console.log(`  Customer: ${customerName || 'N/A'}`);
      console.log(`  Qty: ${qty38} x 38" + ${qty24} x 24" = ${qty38 + qty24}`);
      console.log(`  Status: ${status || 'N/A'}`);

      try {
        // Check if already exists
        const { data: existingSO } = await supabase
          .from('sales_orders')
          .select('id, order_number')
          .eq('order_number', soNumber)
          .maybeSingle();

        if (existingSO) {
          console.log(`  ✓ Already exists - Skipping`);
          totalSkipped++;
          continue;
        }

        // Get or create customer
        const customerId = await getOrCreateCustomer(customerName);

        // Create Quote first
        const { data: quoteNumber } = await supabase.rpc('generate_quote_number');

        const quoteItems = [];
        let quoteSubtotal = 0;

        if (qty38 > 0 && productMap['290/85R38']) {
          const unitPrice = (price38 || 1120) * 100; // Convert to cents
          quoteItems.push({
            product_id: productMap['290/85R38'].id,
            sku: '290/85R38',
            description: productMap['290/85R38'].name,
            quantity: qty38,
            unit_price: unitPrice,
            line_total: unitPrice * qty38,
            sort_order: 0,
          });
          quoteSubtotal += unitPrice * qty38;
        }

        if (qty24 > 0 && productMap['380/85R24']) {
          const unitPrice = (price24 || 1080) * 100; // Convert to cents
          quoteItems.push({
            product_id: productMap['380/85R24'].id,
            sku: '380/85R24',
            description: productMap['380/85R24'].name,
            quantity: qty24,
            unit_price: unitPrice,
            line_total: unitPrice * qty24,
            sort_order: 1,
          });
          quoteSubtotal += unitPrice * qty24;
        }

        // Create Quote
        const { data: newQuote, error: quoteError } = await supabase
          .from('quotes')
          .insert({
            quote_number: quoteNumber,
            customer_id: customerId,
            customer_po_number: customerPO,
            quote_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            valid_until_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'converted',
            currency_code: 'USD',
            subtotal: quoteSubtotal,
            tax_total: 0,
            grand_total: quoteSubtotal,
            shipping_address_street: deliveryAddr || '',
            internal_notes: notes || '',
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (quoteError) {
          console.log(`  ✗ Quote creation failed: ${quoteError.message}`);
          totalErrors++;
          continue;
        }

        // Create Quote Items
        const quoteItemsToInsert = quoteItems.map(item => ({
          ...item,
          quote_id: newQuote.id,
        }));

        await supabase.from('quote_items').insert(quoteItemsToInsert);

        console.log(`  ✓ Quote created: ${quoteNumber}`);

        // Create Sales Order
        const { data: newSO, error: soError } = await supabase
          .from('sales_orders')
          .insert({
            order_number: soNumber,
            customer_id: customerId,
            customer_po_number: customerPO,
            quote_id: newQuote.id,
            order_series: sheetName, // 'GDC 0' or 'GDC 1'
            product_source: 'direct',
            order_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            requested_delivery_date: excelDateToISO(etaPort),
            status: status === 'INVOICED' || status === 'DELIVERED' ? 'delivered' : 'confirmed',
            currency_code: 'USD',
            subtotal: quoteSubtotal,
            tax_total: 0,
            grand_total: quoteSubtotal,
            shipping_address_street: deliveryAddr || '',
            eta_to_us_port: excelDateToISO(etaPort),
            internal_notes: notes || '',
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (soError) {
          console.log(`  ✗ SO creation failed: ${soError.message}`);
          totalErrors++;
          continue;
        }

        // Create SO Items
        const soItemsToInsert = quoteItems.map(item => ({
          ...item,
          sales_order_id: newSO.id,
        }));

        await supabase.from('sales_order_items').insert(soItemsToInsert);

        console.log(`  ✓ Sales Order created: ${soNumber}`);

        // Create Purchase Order
        const { data: poNumber } = await supabase.rpc('generate_po_number');

        const { data: newPO, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            sales_order_id: newSO.id,
            order_series: sheetName,
            po_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            expected_delivery_date: excelDateToISO(etaPort),
            status: 'confirmed',
            currency_code: 'USD',
            subtotal: quoteSubtotal,
            tax_total: 0,
            grand_total: quoteSubtotal,
            ship_to_address_street: deliveryAddr || '',
            internal_notes: `Imported from ${sheetName} - ${notes || ''}`,
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (poError) {
          console.log(`  ✗ PO creation failed: ${poError.message}`);
          totalErrors++;
          continue;
        }

        // Create PO Items
        const poItemsToInsert = quoteItems.map(item => ({
          ...item,
          purchase_order_id: newPO.id,
          quantity_ordered: item.quantity,
          quantity_received: 0,
          unit_code: 'EA',
          supplier_id: supplier.id,
          supplier_name: supplier.name,
        }));

        await supabase.from('purchase_order_items').insert(poItemsToInsert);

        console.log(`  ✓ Purchase Order created: ${poNumber}`);
        console.log(`  ✓ Complete: Quote → SO → PO`);

        totalCreated++;

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('=== Import Summary ===');
  console.log(`Total Rows Processed: ${totalProcessed}`);
  console.log(`Successfully Created: ${totalCreated}`);
  console.log(`Skipped (Already Exist): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log('='.repeat(60));
}

importData()
  .then(() => {
    console.log('\n✅ Import Complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Import Failed:', err);
    process.exit(1);
  });
