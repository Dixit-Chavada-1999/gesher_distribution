#!/usr/bin/env node
/**
 * Remove unique constraint on PO number
 * Reason: Excel has duplicate PO numbers (one PO for multiple SOs)
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Client } = pg;

// Load environment
const envPath = path.resolve(process.cwd(), '.env');
config({ path: envPath });

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

async function removeUniqueConstraint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Remove PO Number UNIQUE Constraint                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('REASON:');
  console.log('Excel માં એક જ PO number multiple SOs માં છે:');
  console.log('  - PO-N145710 → SO2600027, SO2600028, SO2600029');
  console.log('  - PO-N151062 → SO2600045, SO2600046');
  console.log('  - PO-N151896 → SO2600047, SO2600048\n');
  console.log('Database માં પણ આ same રીતે હોવું જોઈએ.\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check existing constraint
    console.log('📍 Checking existing constraints...');

    const checkResult = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'purchase_orders'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%number%';
    `);

    if (checkResult.rows.length > 0) {
      console.log('   Found constraints:');
      checkResult.rows.forEach(row => {
        console.log('   - ' + row.constraint_name);
      });
      console.log('');

      // Drop unique constraint
      console.log('📍 Dropping unique constraint on po_number...');

      await client.query(`
        DROP INDEX IF EXISTS idx_purchase_orders_number_unique;
      `);

      console.log('   ✓ Constraint removed!\n');
    } else {
      console.log('   No unique constraint found on po_number\n');
    }

    console.log('✅ Success!\n');
    console.log('હવે Excel જેમ છે તેમ data add થઈ શકશે:');
    console.log('  - Same PO number multiple SOs માટે ✓');
    console.log('  - No modifications to Excel data ✓\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

removeUniqueConstraint().catch(console.error);
