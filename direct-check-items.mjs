#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Count all items
  const { count } = await supabase
    .from('sales_order_items')
    .select('*', { count: 'exact', head: true });

  console.log(`Total sales_order_items (including deleted): ${count}`);

  // Check for specific orders
  const { data: so37items } = await supabase
    .from('sales_order_items')
    .select('*, sales_orders!inner(order_number)')
    .eq('sales_orders.order_number', 'SO2600037');

  console.log(`\nSO2600037 items: ${so37items?.length || 0}`);
  if (so37items && so37items.length > 0) {
    so37items.forEach(i => {
      console.log(`  - ${i.sku || i.product_name}: ${i.quantity} qty`);
    });
  }
}

check().catch(console.error);
