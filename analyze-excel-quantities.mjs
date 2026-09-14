#!/usr/bin/env node
/**
 * Analyze Excel file - Check all quantities and duplicate POs
 */

import XLSX from 'xlsx';
import path from 'path';

const excelPath = path.resolve('D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx');

console.log('═══════════════════════════════════════════════════════════');
console.log('   EXCEL QUANTITY ANALYSIS                                 ');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  const workbook = XLSX.readFile(excelPath);

  // Read both sheets
  const gdc0Sheet = workbook.Sheets['GDC 0'];
  const gdc1Sheet = workbook.Sheets['GDC 1'];

  if (!gdc0Sheet || !gdc1Sheet) {
    console.log('❌ GDC 0 or GDC 1 sheet not found!');
    process.exit(1);
  }

  const gdc0Data = XLSX.utils.sheet_to_json(gdc0Sheet);
  const gdc1Data = XLSX.utils.sheet_to_json(gdc1Sheet);

  const allData = [...gdc0Data, ...gdc1Data];

  console.log('Total rows in GDC 0: ' + gdc0Data.length);
  console.log('Total rows in GDC 1: ' + gdc1Data.length);
  console.log('Total rows:          ' + allData.length);
  console.log('');

  // ============================================================================
  // CHECK 1: ALL QUANTITIES
  // ============================================================================
  console.log('CHECK 1: ALL QUANTITIES (Column D: QTY)');
  console.log('─'.repeat(80));
  console.log('SO Number   | Customer PO  | Qty  | Series');
  console.log('─'.repeat(80));

  allData.forEach(row => {
    const soNumber = row['SO #'] || row['Load #'] || '(none)';
    const customerPO = row['PO'] || '(none)';
    const qty = row['QTY'] || row['Qty'] || 0;
    const series = gdc0Data.includes(row) ? 'GDC 0' : 'GDC 1';

    console.log(
      String(soNumber).padEnd(11) + ' | ' +
      String(customerPO).padEnd(12) + ' | ' +
      String(qty).padEnd(4) + ' | ' +
      series
    );
  });

  console.log('─'.repeat(80));
  console.log('');

  // ============================================================================
  // CHECK 2: DUPLICATE CUSTOMER POs
  // ============================================================================
  console.log('CHECK 2: DUPLICATE CUSTOMER POs (Group by PO)');
  console.log('─'.repeat(80));

  const poGroups = {};

  allData.forEach(row => {
    const customerPO = row['PO'] || '(none)';
    const qty = row['QTY'] || row['Qty'] || 0;
    const soNumber = row['SO #'] || row['Load #'] || '(none)';

    if (!poGroups[customerPO]) {
      poGroups[customerPO] = [];
    }

    poGroups[customerPO].push({
      soNumber,
      qty,
    });
  });

  // Find duplicates
  const duplicates = Object.entries(poGroups).filter(([po, orders]) => orders.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate customer POs found.');
  } else {
    console.log('Customer PO  | Orders | Quantities | Total');
    console.log('─'.repeat(80));

    duplicates.forEach(([po, orders]) => {
      const soNumbers = orders.map(o => o.soNumber).join(', ');
      const quantities = orders.map(o => o.qty).join(' + ');
      const total = orders.reduce((sum, o) => sum + Number(o.qty), 0);

      console.log(
        po.padEnd(12) + ' | ' +
        String(orders.length).padEnd(6) + ' | ' +
        quantities.padEnd(14) + ' | ' +
        total
      );

      // Show individual orders
      orders.forEach((order, i) => {
        console.log(
          '             │ ' +
          (i + 1) + '. ' + order.soNumber + ': ' + order.qty + ' tires'
        );
      });
      console.log('');
    });
  }

  console.log('─'.repeat(80));
  console.log('');

  // ============================================================================
  // CHECK 3: ANKUR'S EXAMPLE (144 tires = 72 + 72)
  // ============================================================================
  console.log('CHECK 3: VERIFY ANKUR\'S EXAMPLE');
  console.log('─'.repeat(80));
  console.log('Ankur said: "144 tires and one container is 72 tires"');
  console.log('            "so that PO would be in two deliveries" (72 + 72)');
  console.log('');

  duplicates.forEach(([po, orders]) => {
    const total = orders.reduce((sum, o) => sum + Number(o.qty), 0);
    const quantities = orders.map(o => o.qty);

    console.log(`PO: ${po}`);
    console.log(`  Total: ${total} tires`);
    console.log(`  Split: ${quantities.join(' + ')} = ${total}`);

    // Check if it's 72 + 72
    const is72Plus72 = total === 144 && quantities.every(q => q === 72);

    if (is72Plus72) {
      console.log(`  ✅ Matches Ankur's example (72 + 72 = 144)`);
    } else if (total === 144) {
      console.log(`  ⚠️  Total is 144, but split is NOT 72 + 72!`);
      console.log(`     Actual split: ${quantities.join(' + ')}`);
    } else {
      console.log(`  ℹ️  Different scenario (total = ${total})`);
    }
    console.log('');
  });

  console.log('─'.repeat(80));
  console.log('');

  // ============================================================================
  // CHECK 4: CONTAINER CAPACITY ANALYSIS
  // ============================================================================
  console.log('CHECK 4: CONTAINER CAPACITY ANALYSIS');
  console.log('─'.repeat(80));
  console.log('If standard container capacity = 72 tires,');
  console.log('then orders > 72 should be split across multiple containers.');
  console.log('');

  const largeOrders = allData.filter(row => {
    const qty = row['QTY'] || row['Qty'] || 0;
    return qty > 72;
  });

  if (largeOrders.length > 0) {
    console.log('Orders with Qty > 72 (need multiple containers):');
    console.log('SO Number   | Customer PO  | Qty  | Containers Needed');
    console.log('─'.repeat(80));

    largeOrders.forEach(row => {
      const soNumber = row['SO #'] || row['Load #'] || '(none)';
      const customerPO = row['PO'] || '(none)';
      const qty = row['QTY'] || row['Qty'] || 0;
      const containers = Math.ceil(qty / 72);

      console.log(
        String(soNumber).padEnd(11) + ' | ' +
        String(customerPO).padEnd(12) + ' | ' +
        String(qty).padEnd(4) + ' | ' +
        containers + ' containers'
      );
    });
  } else {
    console.log('No orders with Qty > 72 found.');
  }

  console.log('─'.repeat(80));
  console.log('');

  console.log('✅ Analysis complete!');
  console.log('');

} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
  console.error('Path:', excelPath);
}
