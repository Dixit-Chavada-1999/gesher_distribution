import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local'), override: true });

const connectionString = process.env.DIRECT_URL;

if (!connectionString) {
  console.error('Missing DIRECT_URL in environment');
  process.exit(1);
}

async function runMigration() {
  console.log('=== RUNNING MIGRATION 115 ===\n');

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const statements = [
      {
        sql: `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS eta_to_us_port DATE`,
        desc: 'Adding eta_to_us_port column'
      },
      {
        sql: `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS confirmed_eta DATE`,
        desc: 'Adding confirmed_eta column'
      },
      {
        sql: `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS actual_delivery_date DATE`,
        desc: 'Adding actual_delivery_date column'
      },
      {
        sql: `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS qty_delivered INTEGER DEFAULT 0`,
        desc: 'Adding qty_delivered column'
      },
      {
        sql: `ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS outstanding_qty INTEGER DEFAULT 0`,
        desc: 'Adding outstanding_qty column'
      },
    ];

    for (const stmt of statements) {
      console.log(`🔧 ${stmt.desc}...`);
      try {
        await client.query(stmt.sql);
        console.log(`  ✅ Success\n`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  Column already exists\n`);
        } else {
          console.log(`  ❌ Error: ${error.message}\n`);
        }
      }
    }

    console.log('=== MIGRATION COMPLETE ===');
    console.log('✅ All columns added to sales_orders table');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await client.end();
  }
}

// Run
runMigration();
