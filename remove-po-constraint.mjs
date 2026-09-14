#!/usr/bin/env node
/**
 * Remove PO number format constraint directly via SQL
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

async function removeConstraint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Remove PO Number Format Constraint                       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Drop the constraint
    console.log('📍 Dropping purchase_orders_number_format constraint...');

    const result = await client.query(`
      ALTER TABLE purchase_orders
      DROP CONSTRAINT IF EXISTS purchase_orders_number_format;
    `);

    console.log('   ✓ Constraint removed!\n');

    console.log('✅ Success! PO numbers can now use any format:\n');
    console.log('   - PO-2600023 ✓');
    console.log('   - PO-N145669 ✓');
    console.log('   - PONE-3405 ✓\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

removeConstraint().catch(console.error);
