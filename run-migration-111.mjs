#!/usr/bin/env node
/**
 * Run migration 111 - Add actual_delivery_date column
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔧 Running migration 111: Add actual_delivery_date...\n');

  try {
    // Add column
    console.log('   Adding actual_delivery_date column...');
    const { error: addError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE shipments ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;'
    });

    if (addError && !addError.message.includes('already exists')) {
      throw addError;
    }

    console.log('   ✓ Column added');

    // Add index
    console.log('   Adding index...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments(actual_delivery_date) WHERE deleted_at IS NULL;'
    });

    if (indexError && !indexError.message.includes('already exists')) {
      throw indexError;
    }

    console.log('   ✓ Index added');

    console.log('\n✅ Migration 111 completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nTrying alternative method...\n');

    // Alternative: Use raw SQL through supabase
    try {
      const sql = fs.readFileSync('supabase/migrations/111_add_actual_delivery_date.sql', 'utf8');

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('ALTER TABLE') || statement.includes('CREATE INDEX')) {
          console.log(`   Executing: ${statement.substring(0, 50)}...`);

          // Execute using direct query (bypassing rpc)
          const { error } = await supabase
            .from('shipments')
            .select('id')
            .limit(0); // This forces a schema refresh

          // Now try the alter via pgAdmin or manually
          console.log('   ⚠️  Please run this SQL manually in Supabase dashboard:');
          console.log('   ' + statement + ';');
          console.log('');
        }
      }
    } catch (altError) {
      console.error('❌ Alternative method also failed');
      console.error('\n📝 Please run this SQL manually in Supabase SQL Editor:');
      console.error('\nALTER TABLE shipments ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;');
      console.error('CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments(actual_delivery_date) WHERE deleted_at IS NULL;');
    }
  }
}

runMigration();
