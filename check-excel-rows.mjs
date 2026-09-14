#!/usr/bin/env node
/**
 * Check Excel rows for GDC 1 sheet
 */

import XLSX from 'xlsx';
import path from 'path';

const excelPath = 'C:/Users/ADMIN/Downloads/Data Ingestion GDC.xlsx';

console.log('📄 Reading Excel file:', excelPath);
console.log('');

const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets['GDC 1'];

if (!sheet) {
  console.error('❌ GDC 1 sheet not found!');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('           GDC 1 SHEET ROW ANALYSIS                        ');
console.log('═══════════════════════════════════════════════════════════\n');

const getCellValue = (row, col) => {
  const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col });
  const cell = sheet[cellAddress];
  return cell ? cell.v : null;
};

// Check rows 3-20 (should be 18 rows total to include SO2600053)
for (let row = 3; row <= 20; row++) {
  const loadNumber = getCellValue(row, 1); // Column B (Load #)
  const customer = getCellValue(row, 5); // Column F (Customer)
  const qty38 = getCellValue(row, 2); // Column C
  const qty24 = getCellValue(row, 3); // Column D
  const totalQty = getCellValue(row, 4); // Column E
  const status = getCellValue(row, 17); // Column R (Status)

  console.log(`Row ${row}:`);
  console.log(`  Load #: ${loadNumber || '(empty)'}`);
  console.log(`  Customer: ${customer || '(empty)'}`);
  console.log(`  Qty 38": ${qty38 || 0}`);
  console.log(`  Qty 24": ${qty24 || 0}`);
  console.log(`  Total Qty: ${totalQty || 0}`);
  console.log(`  Status: ${status || '(empty)'}`);

  if (!loadNumber) {
    console.log(`  ⚠️  SKIPPED - No load number`);
  }
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('\nExpected GDC 1 range: SO2600037 - SO2600053 (17 orders)');
console.log('Checking if SO2600053 exists in Excel...\n');
