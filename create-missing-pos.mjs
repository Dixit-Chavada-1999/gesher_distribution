import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get a system user ID for created_by (pick first user)
async function getSystemUserId() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Could not find any user! Error:', error);
    throw new Error('No users found in database');
  }

  console.log(`Using user: ${data.email}`);
  return data.id;
}

async function createPOsForSalesOrders() {
  console.log('=== Starting PO Creation ===\n');

  const systemUserId = await getSystemUserId();
  console.log(`System User ID: ${systemUserId}\n`);

  // Get all Sales Orders with GDC order series that don't have POs
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_series,
      product_source,
      status,
      customer_id,
      order_date,
      requested_delivery_date,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      shipping_address_country,
      currency_code,
      warehouse_id,
      customers (name)
    `)
    .is('deleted_at', null)
    .in('order_series', ['GDC 0', 'GDC 1', 'GDC 2', 'GDC 3'])
    .eq('product_source', 'direct')
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered'])
    .order('created_at', { ascending: true });

  if (soError) {
    console.error('Error fetching Sales Orders:', soError);
    return;
  }

  console.log(`Found ${salesOrders?.length || 0} Sales Orders\n`);

  if (!salesOrders || salesOrders.length === 0) {
    console.log('No Sales Orders to process');
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const so of salesOrders) {
    console.log(`\nProcessing ${so.order_number} (${so.order_series})...`);

    // Check if PO already exists
    const { data: existingPO } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .eq('sales_order_id', so.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingPO) {
      console.log(`  ✓ Already has PO: ${existingPO.po_number}`);
      skipped++;
      continue;
    }

    // Get Sales Order Items
    const { data: soItems } = await supabase
      .from('sales_order_items')
      .select(`
        id,
        product_id,
        sku,
        description,
        quantity,
        unit_price,
        products (supplier_id, suppliers (name))
      `)
      .eq('sales_order_id', so.id);

    if (!soItems || soItems.length === 0) {
      console.log(`  ✗ No items found`);
      failed++;
      continue;
    }

    // Get supplier ID from first item (assuming all items from same supplier)
    const firstProduct = soItems[0].products;
    const supplierId = firstProduct?.supplier_id || null;
    const supplierName = firstProduct?.suppliers?.name || 'Unknown Supplier';

    console.log(`  Supplier: ${supplierName}`);
    console.log(`  Items: ${soItems.length}`);

    // Generate PO number
    const { data: poNumber, error: poNumError } = await supabase.rpc('generate_po_number');
    if (poNumError || !poNumber) {
      console.error(`  ✗ Failed to generate PO number:`, poNumError);
      failed++;
      continue;
    }

    console.log(`  New PO#: ${poNumber}`);

    // Calculate subtotal
    const subtotal = soItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    // Create Purchase Order
    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: so.id,
        order_series: so.order_series, // ✅ Important!
        po_date: so.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: so.requested_delivery_date
          ? new Date(so.requested_delivery_date).toISOString().split('T')[0]
          : null,
        status: 'confirmed', // Set as confirmed since SO is already confirmed
        currency_code: so.currency_code || 'USD',
        warehouse_id: so.warehouse_id,
        subtotal: subtotal,
        tax_total: 0,
        shipping_cost: 0,
        grand_total: subtotal,
        vendor_address_street: '',
        vendor_address_city: '',
        vendor_address_state: '',
        vendor_address_postal_code: '',
        vendor_address_country: 'USA',
        ship_to_address_street: so.shipping_address_street || '',
        ship_to_address_city: so.shipping_address_city || '',
        ship_to_address_state: so.shipping_address_state || '',
        ship_to_address_postal_code: so.shipping_address_postal_code || '',
        ship_to_address_country: so.shipping_address_country || 'USA',
        internal_notes: `Backfilled from SO: ${so.order_number}`,
        created_by: systemUserId,
        updated_by: systemUserId,
      })
      .select('id')
      .single();

    if (poError) {
      console.error(`  ✗ Failed to create PO:`, poError.message);
      failed++;
      continue;
    }

    // Create PO Items
    const poItemsToInsert = soItems.map((item, index) => ({
      purchase_order_id: newPO.id,
      product_id: item.product_id,
      sku: item.sku,
      description: item.description,
      quantity_ordered: item.quantity,
      quantity_received: 0,
      unit_code: 'EA',
      unit_price: item.unit_price,
      tax_rate: 0,
      line_total: item.unit_price * item.quantity,
      sort_order: index,
      supplier_id: supplierId,
      supplier_name: supplierName,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItemsToInsert);

    if (itemsError) {
      console.error(`  ✗ Failed to create PO items:`, itemsError.message);
      failed++;
      continue;
    }

    console.log(`  ✓ Created PO: ${poNumber}`);
    created++;

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${salesOrders.length}`);
  console.log(`Created: ${created}`);
  console.log(`Skipped (already have PO): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

createPOsForSalesOrders()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
