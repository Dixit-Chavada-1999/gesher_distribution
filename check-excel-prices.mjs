#!/usr/bin/env node
/**
 * Check Excel file for price columns
 */
import xlsx from 'xlsx';

const ORDERS_FILE = 'D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx';

console.log('📊 Checking Excel file for prices...\n');

const workbook = xlsx.readFile(ORDERS_FILE);

// Check GDC 0 sheet
const gdc0Sheet = workbook.Sheets['GDC 0'];
const gdc0Data = xlsx.utils.sheet_to_json(gdc0Sheet, { header: 1 });

const headers = gdc0Data[2]; // Row 3 (index 2) is headers
console.log('GDC 0 - Column Headers:');
headers.forEach((h, i) => {
  if (h) console.log(`  Column ${i}: ${h}`);
});
console.log('');

// Show first data row with prices
console.log('First Order (Row 4):');
const firstOrder = gdc0Data[3];
console.log(`  Load #: ${firstOrder[1]}`);
console.log(`  38" Qty: ${firstOrder[2]}`);
console.log(`  24" Qty: ${firstOrder[3]}`);
console.log(`  Customer: ${firstOrder[5]}`);
console.log(`  Customer Invoice: ${firstOrder[14]}`);
console.log(`  38" Price: ${firstOrder[15]}`);
console.log(`  24" Price: ${firstOrder[16]}`);
console.log(`  Our Cost: ${firstOrder[19]}`);
console.log('');

// Show second data row
console.log('Second Order (Row 5):');
const secondOrder = gdc0Data[4];
console.log(`  Load #: ${secondOrder[1]}`);
console.log(`  38" Qty: ${secondOrder[2]}`);
console.log(`  24" Qty: ${secondOrder[3]}`);
console.log(`  Customer: ${secondOrder[5]}`);
console.log(`  Customer Invoice: ${secondOrder[14]}`);
console.log(`  38" Price: ${secondOrder[15]}`);
console.log(`  24" Price: ${secondOrder[16]}`);
console.log(`  Our Cost: ${secondOrder[19]}`);
