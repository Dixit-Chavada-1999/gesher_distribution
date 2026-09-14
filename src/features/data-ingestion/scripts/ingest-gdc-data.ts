#!/usr/bin/env tsx
/**
 * GDC DATA INGESTION CLI SCRIPT
 *
 * Usage:
 *   npm run ingest-gdc-data
 *   npm run ingest-gdc-data -- --dry-run
 *   npm run ingest-gdc-data -- --help
 *
 * Source files location:
 *   D:\Project Docs\gesher-distribution\client document\
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file (contains Supabase credentials)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.error('❌ .env file not found at:', envPath);
  process.exit(1);
}

// Also load .env.local if it exists (for local overrides)
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

// Now import services AFTER env vars are loaded
import { IngestionService } from '../services/ingestion.service';
import { IngestionOptions } from '../types';

// Debug: Print env vars to see if they're loaded
console.log('🔍 Environment check:');
console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);
console.log('');

// File paths (adjust these if needed)
const CLIENT_DOCS_DIR = path.resolve('D:\\Project Docs\\gesher-distribution\\client document');
const ORDERS_FILE = path.join(CLIENT_DOCS_DIR, 'Data Ingestion GDC.xlsx');
const CUSTOMERS_FILE = path.join(CLIENT_DOCS_DIR, 'Customers EIN Included.xlsx');

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         GDC HISTORICAL DATA INGESTION TOOL                 ║');
  console.log('║         Quote-First Approach                               ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  // Verify source files exist
  const fs = require('fs');
  if (!fs.existsSync(ORDERS_FILE)) {
    console.error('❌ Error: Orders file not found at:');
    console.error(`   ${ORDERS_FILE}`);
    console.error('');
    console.error('Please ensure the file exists or update the path in:');
    console.error('   src/features/data-ingestion/scripts/ingest-gdc-data.ts');
    process.exit(1);
  }

  if (!fs.existsSync(CUSTOMERS_FILE)) {
    console.error('❌ Error: Customers file not found at:');
    console.error(`   ${CUSTOMERS_FILE}`);
    console.error('');
    console.error('Please ensure the file exists or update the path in:');
    console.error('   src/features/data-ingestion/scripts/ingest-gdc-data.ts');
    process.exit(1);
  }

  console.log('📂 Source Files:');
  console.log(`   Orders:    ${ORDERS_FILE}`);
  console.log(`   Customers: ${CUSTOMERS_FILE}`);
  console.log('');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No data will be written to database\n');
  } else {
    console.log('⚠️  LIVE MODE - Data will be written to database');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await sleep(5000);
  }

  // Prepare options
  const options: IngestionOptions = {
    dryRun: isDryRun,
    skipExistingOrders: true,
    sessionName: `GDC Import ${new Date().toISOString()}`,
    createdBy: 'system', // TODO: Get actual user ID
  };

  // Run ingestion
  const ingestionService = new IngestionService();

  try {
    const result = await ingestionService.ingest(ORDERS_FILE, CUSTOMERS_FILE, options);

    if (result.success) {
      console.log('\n✅ SUCCESS! Data ingestion completed.');
      process.exit(0);
    } else {
      console.log('\n❌ FAILED! Data ingestion encountered errors.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function printHelp() {
  console.log('Usage: npm run ingest-gdc-data [options]');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run    Run in dry-run mode (no database writes)');
  console.log('  --help, -h   Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run ingest-gdc-data              # Run full ingestion');
  console.log('  npm run ingest-gdc-data -- --dry-run # Test without writing');
  console.log('');
  console.log('Source Files:');
  console.log(`  ${ORDERS_FILE}`);
  console.log(`  ${CUSTOMERS_FILE}`);
  console.log('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run main function
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
