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
    customerName = 'Gesher Distribution Company';
  }

  // Check if customer exists
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', `%${customerName}%`)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  // Generate customer code from name (first 3 letters + random number)
  const customerCode = customerName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 10000);

  // Create new customer
  const { data: newCustomer, error: customerError } = await supabase
    .from('customers')
    .insert({
      customer_code: customerCode,
      name: customerName,
      channel: 'oem',
      status: 'active',
    })
    .select('id')
    .single();

  if (customerError) {
    console.log(`    Warning: Customer creation failed: ${customerError.message}`);
    return null;
  }

  console.log(`    Created new customer: ${customerName} (${customerCode})`);
  return newCustomer?.id;
}

// Get products (tires)
async function getProducts() {
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name')
    .in('sku', ['290-85R38', '380-85R24']);

  const productMap = {};
  products?.forEach(p => {
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

  return data;
}

// Parse address
function parseAddress(addressString) {
  if (!addressString) return {};

  const parts = addressString.split(',').map(s => s.trim());

  return {
    street: parts[0] || '',
    city: parts[1] || '',
    state: parts[2]?.split(' ')[0] || '',
    postal_code: parts[2]?.split(' ')[1] || '',
    country: 'USA'
  };
}

async function importData() {
  console.log('=== Starting Fresh GDC Data Import ===\n');

  const systemUser = await getSystemUser();
  console.log(`System User: ${systemUser.email}\n`);

  const productMap = await getProducts();
  console.log('Products:', Object.keys(productMap).filter(k => k.includes('-')).join(', '));

  const supplier = await getSupplier();
  console.log(`Supplier: ${supplier?.name}\n`);

  const workbook = XLSX.readFile(filePath);

  let totalCreated = 0;
  let totalErrors = 0;

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Sheet: ${sheetName}`);
    console.log('='.repeat(60));

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet);

    // Skip first 2 rows (title and headers)
    const dataRows = rawData.slice(2).filter(row => {
      // Filter out empty rows
      const values = Object.values(row);
      return values.some(v => v !== null && v !== undefined && v !== '');
    });

    console.log(`Rows to process: ${dataRows.length}\n`);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      // Extract data based on sheet
      let soNumber, qty38, qty24, customerName, customerPO, etaPort, deliveryAddr, status, notes;
      let price38, price24, invoiceAmt, confirmedEta, expectedDelivery, actualDelivery;

      if (sheetName === 'GDC 0') {
        soNumber = row['__EMPTY'];
        qty38 = row['__EMPTY_1'] || 0;
        qty24 = row['__EMPTY_2'] || 0;
        customerName = row['__EMPTY_4'];
        customerPO = row['__EMPTY_5'];
        etaPort = row['__EMPTY_6'];
        deliveryAddr = row['__EMPTY_7'];
        confirmedEta = row['__EMPTY_8'];
        expectedDelivery = row['__EMPTY_9'];
        actualDelivery = row['__EMPTY_10'];
        status = row['__EMPTY_16'];
        notes = row['__EMPTY_17'];
        price38 = row['__EMPTY_14'] || 1120;
        price24 = row['__EMPTY_15'] || 1080;
        invoiceAmt = row['__EMPTY_13'];
      } else {
        // GDC 1
        soNumber = row['__EMPTY_1'];
        qty38 = row['__EMPTY_2'] || 0;
        qty24 = row['__EMPTY_3'] || 0;
        customerName = row['__EMPTY_5'];
        customerPO = row['__EMPTY_6'];
        deliveryAddr = row['__EMPTY_7'];
        etaPort = row['__EMPTY_8'];
        expectedDelivery = row['__EMPTY_9'];
        status = row['__EMPTY_15'];
        notes = row['__EMPTY_16'];
        price38 = row['__EMPTY_13'] || 1120;
        price24 = row['__EMPTY_14'] || 1080;
        invoiceAmt = row['__EMPTY_12'];
      }

      if (!soNumber) continue;

      console.log(`Row ${i + 1}: ${soNumber}`);
      console.log(`  Customer: ${customerName || 'Gesher'}`);
      console.log(`  Qty: ${qty38} x 38" + ${qty24} x 24"`);

      try {
        // Get or create customer
        const customerId = await getOrCreateCustomer(customerName);

        // Parse address
        const address = parseAddress(deliveryAddr);

        // Build items
        const items = [];
        let subtotal = 0;

        if (qty38 > 0 && productMap['290-85R38']) {
          const unitPrice = Math.round(price38 * 100);
          items.push({
            product_id: productMap['290-85R38'].id,
            sku: '290-85R38',
            description: productMap['290-85R38'].name,
            quantity: qty38,
            unit_price: unitPrice,
            line_total: unitPrice * qty38,
            sort_order: 0,
          });
          subtotal += unitPrice * qty38;
        }

        if (qty24 > 0 && productMap['380-85R24']) {
          const unitPrice = Math.round(price24 * 100);
          items.push({
            product_id: productMap['380-85R24'].id,
            sku: '380-85R24',
            description: productMap['380-85R24'].name,
            quantity: qty24,
            unit_price: unitPrice,
            line_total: unitPrice * qty24,
            sort_order: 1,
          });
          subtotal += unitPrice * qty24;
        }

        if (items.length === 0) {
          console.log(`  ✗ No valid items - skipping`);
          continue;
        }

        // Create Quote
        const { data: quoteNumber } = await supabase.rpc('generate_quote_number');

        const { data: newQuote, error: quoteError} = await supabase
          .from('quotes')
          .insert({
            quote_number: quoteNumber,
            customer_id: customerId,
            customer_po_number: customerPO,
            quote_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            status: 'converted',
            currency_code: 'USD',
            subtotal: subtotal,
            tax_total: 0,
            grand_total: subtotal,
            shipping_address_street: address.street,
            shipping_address_city: address.city,
            shipping_address_state: address.state,
            shipping_address_postal_code: address.postal_code,
            internal_notes: notes || '',
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (quoteError) throw new Error(`Quote: ${quoteError.message}`);

        // Create Quote Items
        await supabase.from('quote_items').insert(
          items.map(item => ({ ...item, quote_id: newQuote.id }))
        );

        // Determine SO status based on Excel status
        let soStatus = 'confirmed';
        if (status === 'INVOICED' || status === 'DELIVERED') {
          soStatus = 'delivered';
        } else if (status === 'IN TRANSIT') {
          soStatus = 'shipped';
        } else if (status === 'OPEN') {
          soStatus = 'processing';
        }

        // Create Sales Order
        const { data: newSO, error: soError } = await supabase
          .from('sales_orders')
          .insert({
            order_number: soNumber,
            customer_id: customerId,
            customer_po_number: customerPO,
            quote_id: newQuote.id,
            order_series: sheetName,
            product_source: 'direct',
            order_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            requested_delivery_date: excelDateToISO(expectedDelivery),
            actual_delivery_date: excelDateToISO(actualDelivery),
            status: soStatus,
            currency_code: 'USD',
            subtotal: subtotal,
            tax_total: 0,
            grand_total: subtotal,
            shipping_address_street: address.street,
            shipping_address_city: address.city,
            shipping_address_state: address.state,
            shipping_address_postal_code: address.postal_code,
            eta_to_us_port: excelDateToISO(etaPort),
            confirmed_eta: excelDateToISO(confirmedEta),
            internal_notes: notes || '',
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (soError) throw new Error(`SO: ${soError.message}`);

        // Create SO Items
        await supabase.from('sales_order_items').insert(
          items.map(item => ({ ...item, sales_order_id: newSO.id }))
        );

        // Determine PO status
        let poStatus = 'confirmed';
        if (status === 'DRAFT' || status === 'OPEN') {
          poStatus = 'draft';
        }

        // Create Purchase Order
        const { data: poNumber } = await supabase.rpc('generate_po_number');

        const { data: newPO, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            po_number: poNumber,
            sales_order_id: newSO.id,
            order_series: sheetName,
            po_date: excelDateToISO(etaPort) || new Date().toISOString().split('T')[0],
            expected_delivery_date: excelDateToISO(expectedDelivery),
            status: poStatus,
            currency_code: 'USD',
            subtotal: subtotal,
            tax_total: 0,
            grand_total: subtotal,
            ship_to_address_street: address.street,
            ship_to_address_city: address.city,
            ship_to_address_state: address.state,
            ship_to_address_postal_code: address.postal_code,
            internal_notes: notes || '',
            created_by: systemUser.id,
            updated_by: systemUser.id,
          })
          .select('id')
          .single();

        if (poError) throw new Error(`PO: ${poError.message}`);

        // Create PO Items
        const { error: poItemsError } = await supabase.from('purchase_order_items').insert(
          items.map((item, idx) => ({
            purchase_order_id: newPO.id,
            product_id: item.product_id,
            sku: item.sku,
            description: item.description,
            quantity_ordered: item.quantity,
            quantity_received: 0,
            unit_code: 'EA',
            unit_price: item.unit_price,
            tax_rate: 0,
            line_total: item.line_total,
            sort_order: item.sort_order || idx,
            supplier_id: supplier?.id || null,
            supplier_name: supplier?.name || 'Unknown Supplier',
          }))
        );

        if (poItemsError) throw new Error(`PO Items: ${poItemsError.message}`);

        console.log(`  ✓ Created: ${quoteNumber} → ${soNumber} → ${poNumber}`);
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
  console.log(`Successfully Created: ${totalCreated}`);
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
