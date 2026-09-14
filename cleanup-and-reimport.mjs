#!/usr/bin/env node
/**
 * Cleanup and re-import GDC data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Load environment
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('🗑️  Cleaning up existing GDC data...\n');

  const orderNumbers = [];
  for (let i = 23; i <= 52; i++) {
    orderNumbers.push(`SO2600${String(i).padStart(3, '0')}`);
  }

  console.log(`   Deleting ${orderNumbers.length} sales orders...`);

  const { error: soError } = await supabase
    .from('sales_orders')
    .delete()
    .in('order_number', orderNumbers);

  if (soError) {
    console.error('❌ Failed to delete sales orders:', soError.message);
    throw soError;
  }

  console.log('   ✓ Deleted sales orders');

  const quoteNumbers = orderNumbers.map(so => so.replace('SO', 'QT'));

  console.log(`   Deleting ${quoteNumbers.length} quotes...`);

  const { error: quoteError } = await supabase
    .from('quotes')
    .delete()
    .in('quote_number', quoteNumbers);

  if (quoteError) {
    console.error('❌ Failed to delete quotes:', quoteError.message);
    throw quoteError;
  }

  console.log('   ✓ Deleted quotes\n');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         CLEANUP AND RE-IMPORT GDC DATA                    ');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Cleanup
    await cleanup();

    console.log('✅ Cleanup complete!\n');
    console.log('📥 Starting re-import...\n');

    // Step 2: Re-import using npm script
    execSync('npm run ingest-gdc-data', { stdio: 'inherit' });

    console.log('\n🎉 Re-import completed!\n');
  } catch (error) {
    console.error('\n❌ Process failed:', error.message);
    process.exit(1);
  }
}

main();
