#!/usr/bin/env node
/**
 * FORCE REMOVE all unique constraints on PO number
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

async function forceRemoveConstraints() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   FORCE REMOVE All PO Unique Constraints                   ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Find ALL constraints and indexes on po_number
    console.log('📍 Finding all constraints/indexes on po_number...\n');

    const constraintsResult = await client.query(`
      SELECT
        conname AS constraint_name,
        contype AS constraint_type
      FROM pg_constraint
      WHERE conrelid = 'purchase_orders'::regclass
        AND conname LIKE '%number%';
    `);

    const indexesResult = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'purchase_orders'
        AND indexname LIKE '%number%';
    `);

    console.log('Found Constraints:');
    if (constraintsResult.rows.length > 0) {
      constraintsResult.rows.forEach(row => {
        console.log('  - ' + row.constraint_name + ' (type: ' + row.constraint_type + ')');
      });
    } else {
      console.log('  (none)');
    }

    console.log('\nFound Indexes:');
    if (indexesResult.rows.length > 0) {
      indexesResult.rows.forEach(row => {
        console.log('  - ' + row.indexname);
      });
    } else {
      console.log('  (none)');
    }

    console.log('');

    // Drop all constraints
    for (const row of constraintsResult.rows) {
      console.log('📍 Dropping constraint: ' + row.constraint_name);
      try {
        await client.query(`
          ALTER TABLE purchase_orders
          DROP CONSTRAINT ${row.constraint_name};
        `);
        console.log('   ✓ Dropped\n');
      } catch (err) {
        console.log('   ✗ Failed: ' + err.message + '\n');
      }
    }

    // Drop all indexes
    for (const row of indexesResult.rows) {
      console.log('📍 Dropping index: ' + row.indexname);
      try {
        await client.query(`
          DROP INDEX IF EXISTS ${row.indexname};
        `);
        console.log('   ✓ Dropped\n');
      } catch (err) {
        console.log('   ✗ Failed: ' + err.message + '\n');
      }
    }

    // Verify removal
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 VERIFICATION:\n');

    const verifyConstraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'purchase_orders'::regclass
        AND conname LIKE '%number%';
    `);

    const verifyIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'purchase_orders'
        AND indexname LIKE '%number%';
    `);

    if (verifyConstraints.rows.length === 0 && verifyIndexes.rows.length === 0) {
      console.log('✅ SUCCESS! All constraints/indexes removed!\n');
      console.log('હવે duplicate PO numbers allow થશે! 🎉\n');
    } else {
      console.log('⚠️  Some constraints/indexes still remain:\n');
      verifyConstraints.rows.forEach(row => console.log('  - Constraint: ' + row.conname));
      verifyIndexes.rows.forEach(row => console.log('  - Index: ' + row.indexname));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

forceRemoveConstraints().catch(console.error);
