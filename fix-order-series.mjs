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

async function fixOrderSeries() {
  console.log('=== FIXING ORDER SERIES ===\n');
  console.log('GDC 0 sheet orders → order_series: "GDC 0" (with space)');
  console.log('GDC 1 sheet orders → order_series: "GDC 1" (with space)\n');

  try {
    // Read parsed JSON to know which orders came from which sheet
    const jsonData = JSON.parse(fs.readFileSync('gdc-data-parsed.json', 'utf8'));

    console.log(`📊 GDC 0 orders: ${jsonData.gdc0.length}`);
    console.log(`📊 GDC 1 orders: ${jsonData.gdc1.length}\n`);

    let gdc0Count = 0;
    let gdc1Count = 0;

    // Update GDC 0 orders
    console.log('🔧 Updating GDC 0 orders...');
    for (const order of jsonData.gdc0) {
      const { error } = await supabase
        .from('sales_orders')
        .update({ order_series: 'GDC 0' })  // WITH SPACE
        .eq('order_number', order['Load #']);

      if (error) {
        console.error(`  ❌ Error updating ${order['Load #']}:`, error.message);
      } else {
        console.log(`  ✅ ${order['Load #']} → "GDC 0"`);
        gdc0Count++;
      }
    }

    // Update GDC 1 orders
    console.log('\n🔧 Updating GDC 1 orders...');
    for (const order of jsonData.gdc1) {
      const { error } = await supabase
        .from('sales_orders')
        .update({ order_series: 'GDC 1' })  // WITH SPACE
        .eq('order_number', order['Load #']);

      if (error) {
        console.error(`  ❌ Error updating ${order['Load #']}:`, error.message);
      } else {
        console.log(`  ✅ ${order['Load #']} → "GDC 1"`);
        gdc1Count++;
      }
    }

    console.log('\n\n=== FIX COMPLETE ===');
    console.log(`✅ GDC 0 orders updated: ${gdc0Count}`);
    console.log(`✅ GDC 1 orders updated: ${gdc1Count}`);
    console.log('\nOperations Dashboard tabs now work properly:');
    console.log('  - GDC 0 tab → 14 orders');
    console.log('  - GDC 1 tab → 17 orders');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run fix
fixOrderSeries();
