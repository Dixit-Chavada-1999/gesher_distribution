#!/usr/bin/env node
/**
 * Database cleanup script runner
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runCleanup() {
  console.log('🧹 Starting database cleanup...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read cleanup SQL file
  const sqlFile = path.join(__dirname, 'cleanup_database_v2.sql');
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Split by semicolon and filter out comments/empty lines
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

  console.log(`📄 Found ${statements.length} SQL statements\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip SELECT statements (verification queries)
    if (statement.toUpperCase().startsWith('SELECT')) {
      continue;
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct execution for DELETE statements
        const tableName = statement.match(/DELETE FROM (\w+)/i)?.[1];
        if (tableName) {
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

          if (deleteError) {
            console.error(`❌ Error on ${tableName}: ${deleteError.message}`);
            errorCount++;
          } else {
            console.log(`✓ Cleaned ${tableName}`);
            successCount++;
          }
        }
      } else {
        successCount++;
      }
    } catch (err) {
      errorCount++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('           CLEANUP SUMMARY              ');
  console.log('═══════════════════════════════════════');
  console.log(`✓ Successful: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════\n');

  // Verify cleanup
  console.log('🔍 Verifying cleanup...\n');

  const tables = [
    'customers',
    'products',
    'quotes',
    'sales_orders',
    'purchase_orders',
    'invoices',
    'shipments'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    if (!error) {
      console.log(`   ${table}: ${count || 0} records`);
    }
  }

  console.log('\n✅ Database cleanup complete!\n');
}

runCleanup().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
