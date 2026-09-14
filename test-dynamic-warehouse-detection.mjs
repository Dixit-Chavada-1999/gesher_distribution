#!/usr/bin/env node
/**
 * Test dynamic warehouse location detection
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWarehouseDetection() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DYNAMIC WAREHOUSE LOCATION DETECTION TEST                ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Fetch warehouse locations from database
  console.log('1️⃣  Fetching warehouse locations from database...\n');

  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, location_code, location_type, is_active')
    .eq('location_type', 'warehouse')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) {
    console.log('❌ Error fetching locations: ' + error.message);
    return;
  }

  console.log('Found ' + locations.length + ' warehouse locations:');
  locations.forEach(loc => {
    console.log('  - ' + loc.name + ' (' + loc.location_code + ')');
  });
  console.log('');

  // 2. Build warehouse name list (same as ingestion service)
  const warehouseNames = locations.map(loc => loc.name);
  warehouseNames.push('Gesher Distribution Company');
  warehouseNames.push('Gesher');

  console.log('Warehouse name list (for matching):');
  warehouseNames.forEach(name => {
    console.log('  - ' + name);
  });
  console.log('');

  // 3. Test customer name matching
  console.log('2️⃣  Testing customer name matching...\n');

  const testCases = [
    { customerName: 'Nebraska Warehouse', expected: 'warehouse' },
    { customerName: 'Kansas Warehouse', expected: 'warehouse' },
    { customerName: 'Gesher Distribution Company', expected: 'warehouse' },
    { customerName: 'Valmont Industries', expected: 'direct' },
    { customerName: 'Lindsay', expected: 'direct' },
    { customerName: 'WISH Nebraska', expected: 'direct' },
  ];

  console.log('Test Cases:');
  console.log('─────────────────────────────────────────────────────────');

  let passed = 0;
  let failed = 0;

  testCases.forEach(test => {
    const isWarehouse = warehouseNames.some(
      name => test.customerName.toLowerCase().includes(name.toLowerCase())
    );
    const result = isWarehouse ? 'warehouse' : 'direct';
    const status = result === test.expected ? '✅' : '❌';

    console.log(status + '  "' + test.customerName + '" → ' + result + ' (expected: ' + test.expected + ')');

    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('─────────────────────────────────────────────────────────\n');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed\n');

  // 4. Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    SUMMARY                                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('✅ SUCCESS! Dynamic warehouse detection works correctly!\n');
    console.log('   ✓ Warehouse locations loaded from database');
    console.log('   ✓ Customer name matching logic correct');
    console.log('   ✓ All test cases passed');
    console.log('');
    console.log('   હવે જ્યારે પણ નવું warehouse locations table માં add થશે,');
    console.log('   ingestion service automatically એને detect કરશે! 🎉\n');
  } else {
    console.log('⚠️  Some tests failed. Please check the logic.\n');
  }
}

testWarehouseDetection().catch(console.error);
