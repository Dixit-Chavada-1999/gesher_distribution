#!/usr/bin/env node
/**
 * Import products from CSV file
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';

config();

const CSV_FILE = 'C:\\Users\\ADMIN\\Downloads\\ProductsServicesList_Gesher_Distribution,_Inc_8_6_2026.csv';

// Fixed prices from our earlier PDF analysis
const PRODUCT_PRICES = {
  '290/85R38': 110000, // $1,100
  '380/85R24': 110000, // $1,100
  'COMMISSION': 27500, // $275
};

const PRODUCT_COSTS = {
  '290/85R38': 80000, // $800
  '380/85R24': 80000, // $800
  'COMMISSION': 0,
};

async function importProducts() {
  console.log('📦 Importing products from CSV...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read and parse CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvContent.split('\n').filter(l => l.trim());

  // Parse CSV manually (simple CSV parser)
  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCsvLine(line));

  console.log(`📊 Found ${rows.length} products in CSV\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const product = {
      name: row[0],
      sku: row[7] || null,
      itemType: row[3], // Inventory, Non-Inventory, Service
      description: row[15] || row[0],
      taxable: row[9] === 'Yes',
      supplier: row[18] || null,
    };

    // Skip products without SKU or name
    if (!product.name || !product.sku) {
      console.log(`  ⊘ Skipped: ${product.name || 'Unnamed'} (no SKU)`);
      skipped++;
      continue;
    }

    // Normalize SKU for database
    let normalizedSku = product.sku
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9\-]/g, '');

    // Map item type to our enum
    let itemType = 'inventory';
    if (product.itemType === 'Service') {
      itemType = 'service';
    } else if (product.itemType === 'Non-Inventory') {
      itemType = 'non_inventory';
    }

    // Determine price and cost
    let basePrice = 0;
    let baseCost = 0;

    if (normalizedSku.includes('290') || normalizedSku.includes('38')) {
      basePrice = PRODUCT_PRICES['290/85R38'];
      baseCost = PRODUCT_COSTS['290/85R38'];
    } else if (normalizedSku.includes('380') || normalizedSku.includes('24')) {
      basePrice = PRODUCT_PRICES['380/85R24'];
      baseCost = PRODUCT_COSTS['380/85R24'];
    } else if (normalizedSku.includes('COMMISSION')) {
      basePrice = PRODUCT_PRICES['COMMISSION'];
      baseCost = PRODUCT_COSTS['COMMISSION'];
    }

    // Determine category and tire size
    let category = null;
    let tireSize = null;
    let rimSize = null;

    if (itemType === 'service') {
      category = 'Services';
    } else if (product.name.includes('38')) {
      category = 'Tires';
      tireSize = '290/85R38';
      rimSize = '11.2-38';
    } else if (product.name.includes('24')) {
      category = 'Tires';
      tireSize = '380/85R24';
      rimSize = product.name.includes('2" Offset') ? '14.9-24 (2" Offset)' : '14.9-24';
    }

    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, sku')
      .eq('sku', normalizedSku)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      // Update existing product
      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          description: product.description,
          item_type: itemType,
          base_price: basePrice,
          base_cost: baseCost,
          category: category,
          tire_size: tireSize,
          rim_size: rimSize,
        })
        .eq('id', existing.id);

      if (error) {
        console.log(`  ❌ Error updating ${normalizedSku}: ${error.message}`);
        errors++;
      } else {
        console.log(`  ↻ Updated: ${normalizedSku} - ${product.name}`);
        updated++;
      }
    } else {
      // Create new product
      const { error } = await supabase
        .from('products')
        .insert({
          sku: normalizedSku,
          name: product.name,
          description: product.description,
          item_type: itemType,
          base_price: basePrice,
          base_cost: baseCost,
          category: category,
          tire_size: tireSize,
          rim_size: rimSize,
          status: 'active',
          is_sellable: true,
        });

      if (error) {
        console.log(`  ❌ Error creating ${normalizedSku}: ${error.message}`);
        errors++;
      } else {
        console.log(`  + Created: ${normalizedSku} - ${product.name}`);
        created++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('          IMPORT SUMMARY                ');
  console.log('═══════════════════════════════════════');
  console.log(`Products in CSV:     ${rows.length}`);
  console.log(`Created:             ${created}`);
  console.log(`Updated:             ${updated}`);
  console.log(`Skipped:             ${skipped}`);
  console.log(`Errors:              ${errors}`);
  console.log('═══════════════════════════════════════\n');

  // Verify final count
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);

  console.log(`✅ Total products in database: ${count}\n`);
}

importProducts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
