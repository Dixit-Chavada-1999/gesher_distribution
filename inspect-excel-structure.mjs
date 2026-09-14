#!/usr/bin/env node
/**
 * Inspect Excel file structure - See column headers
 */

import XLSX from 'xlsx';
import path from 'path';

const excelPath = path.resolve('D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx');

console.log('═══════════════════════════════════════════════════════════');
console.log('   EXCEL FILE STRUCTURE INSPECTION                         ');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('File: ' + excelPath);
console.log('');

try {
  const workbook = XLSX.readFile(excelPath);

  console.log('Sheet Names:');
  workbook.SheetNames.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`);
  });
  console.log('');

  // Check GDC 0 sheet
  if (workbook.Sheets['GDC 0']) {
    console.log('─'.repeat(80));
    console.log('GDC 0 SHEET');
    console.log('─'.repeat(80));

    const gdc0Data = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 0'], { header: 1 });

    console.log('Total rows: ' + gdc0Data.length);
    console.log('');

    // Show first 5 rows
    console.log('First 5 rows (raw data):');
    gdc0Data.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}: `, JSON.stringify(row));
    });
    console.log('');

    // Try to detect headers
    if (gdc0Data.length > 0) {
      console.log('Detected Column Headers (Row 0):');
      gdc0Data[0].forEach((header, i) => {
        console.log(`  Column ${String.fromCharCode(65 + i)} (index ${i}): "${header}"`);
      });
      console.log('');
    }

    // Show first data row
    if (gdc0Data.length > 1) {
      console.log('First Data Row (Row 1):');
      gdc0Data[1].forEach((value, i) => {
        const header = gdc0Data[0][i] || `Column ${i}`;
        console.log(`  ${header}: ${value}`);
      });
      console.log('');
    }
  }

  // Check GDC 1 sheet
  if (workbook.Sheets['GDC 1']) {
    console.log('─'.repeat(80));
    console.log('GDC 1 SHEET');
    console.log('─'.repeat(80));

    const gdc1Data = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 1'], { header: 1 });

    console.log('Total rows: ' + gdc1Data.length);
    console.log('');

    // Show first 5 rows
    console.log('First 5 rows (raw data):');
    gdc1Data.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}: `, JSON.stringify(row));
    });
    console.log('');

    // Try to detect headers
    if (gdc1Data.length > 0) {
      console.log('Detected Column Headers (Row 0):');
      gdc1Data[0].forEach((header, i) => {
        console.log(`  Column ${String.fromCharCode(65 + i)} (index ${i}): "${header}"`);
      });
      console.log('');
    }

    // Show first data row
    if (gdc1Data.length > 1) {
      console.log('First Data Row (Row 1):');
      gdc1Data[1].forEach((value, i) => {
        const header = gdc1Data[0][i] || `Column ${i}`;
        console.log(`  ${header}: ${value}`);
      });
      console.log('');
    }
  }

} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
  console.error('Path:', excelPath);
}
