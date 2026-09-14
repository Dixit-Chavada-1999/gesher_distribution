#!/usr/bin/env node
/**
 * Analyze Excel file - Correct version with proper row parsing
 */

import XLSX from 'xlsx';
import path from 'path';

const excelPath = path.resolve('D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx');

console.log('═══════════════════════════════════════════════════════════');
console.log('   EXCEL QUANTITY ANALYSIS (All Orders)                    ');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  const workbook = XLSX.readFile(excelPath);

  // Read both sheets as raw arrays
  const gdc0Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 0'], { header: 1 });
  const gdc1Raw = XLSX.utils.sheet_to_json(workbook.Sheets['GDC 1'], { header: 1 });

  // Headers are in Row 2 (index 2), Data starts from Row 3 (index 3)
  const gdc0Headers = gdc0Raw[2];
  const gdc1Headers = gdc1Raw[2];

  // Parse GDC 0 data
  const gdc0Data = [];
  for (let i = 3; i < gdc0Raw.length; i++) {
    const row = gdc0Raw[i];
    if (!row || row.length === 0 || !row[1]) continue; // Skip empty rows

    gdc0Data.push({
      no: row[0],
      loadNumber: row[1],
      sku38Qty: row[2] || 0,
      sku24Qty: row[3] || 0,
      totalQty: row[4] || 0,
      customer: row[5],
      po: row[6],
      etaPort: row[7],
      deliveryAddress: row[8],
      series: 'GDC 0',
    });
  }

  // Parse GDC 1 data
  const gdc1Data = [];
  for (let i = 3; i < gdc1Raw.length; i++) {
    const row = gdc1Raw[i];
    if (!row || row.length === 0 || !row[1]) continue; // Skip empty rows

    gdc1Data.push({
      no: row[0],
      loadNumber: row[1],
      sku38Qty: row[2] || 0,
      sku24Qty: row[3] || 0,
      totalQty: row[4] || 0,
      customer: row[5],
      po: row[6],
      deliveryAddress: row[7],
      series: 'GDC 1',
    });
  }

  const allData = [...gdc0Data, ...gdc1Data];

  console.log(`GDC 0 Orders: ${gdc0Data.length}`);
  console.log(`GDC 1 Orders: ${gdc1Data.length}`);
  console.log(`Total Orders: ${allData.length}`);
  console.log('');

  // ============================================================================
  // CHECK 1: ALL QUANTITIES
  // ============================================================================
  console.log('CHECK 1: ALL QUANTITIES');
  console.log('─'.repeat(90));
  console.log('SO Number   | Customer PO  | 38" Qty | 24" Qty | Total | Series');
  console.log('─'.repeat(90));

  allData.forEach(row => {
    console.log(
      String(row.loadNumber).padEnd(11) + ' | ' +
      String(row.po).padEnd(12) + ' | ' +
      String(row.sku38Qty).padEnd(7) + ' | ' +
      String(row.sku24Qty).padEnd(7) + ' | ' +
      String(row.totalQty).padEnd(5) + ' | ' +
      row.series
    );
  });

  console.log('─'.repeat(90));
  console.log('');

  // ============================================================================
  // CHECK 2: DUPLICATE CUSTOMER POs
  // ============================================================================
  console.log('CHECK 2: DUPLICATE CUSTOMER POs (Same PO, Multiple Orders)');
  console.log('─'.repeat(90));

  const poGroups = {};

  allData.forEach(row => {
    const po = row.po;
    if (!po || po.toString().startsWith('Q')) return; // Skip quotes

    if (!poGroups[po]) {
      poGroups[po] = [];
    }

    poGroups[po].push(row);
  });

  // Find duplicates
  const duplicates = Object.entries(poGroups).filter(([po, orders]) => orders.length > 1);

  if (duplicates.length === 0) {
    console.log('❌ No duplicate customer POs found (but should have PO-N145710, etc.)');
  } else {
    console.log(`Found ${duplicates.length} duplicate customer POs:\n`);

    duplicates.forEach(([po, orders]) => {
      console.log(`📦 Customer PO: ${po}`);
      console.log(`   Total Orders: ${orders.length}`);
      console.log(`   Breakdown:`);

      let totalQty = 0;
      orders.forEach((order, i) => {
        console.log(
          `     ${i + 1}. ${order.loadNumber}: ` +
          `${order.totalQty} tires ` +
          `(38" × ${order.sku38Qty} + 24" × ${order.sku24Qty})`
        );
        totalQty += order.totalQty;
      });

      console.log(`   Total Qty: ${totalQty} tires`);

      // Check if it matches Ankur's example (144 = 72 + 72)
      const quantities = orders.map(o => o.totalQty);
      const is144 = totalQty === 144;
      const is72x2 = is144 && quantities.every(q => q === 72) && quantities.length === 2;

      if (is72x2) {
        console.log(`   ✅ Matches Ankur's example: 144 tires = 72 + 72 (2 containers)`);
      } else if (is144) {
        console.log(`   ⚠️  Total is 144, but split is NOT 72 + 72!`);
        console.log(`      Actual split: ${quantities.join(' + ')} = ${totalQty}`);
      } else {
        console.log(`   ℹ️  Different scenario: Total = ${totalQty} tires`);
        console.log(`      Split: ${quantities.join(' + ')}`);
      }
      console.log('');
    });
  }

  console.log('─'.repeat(90));
  console.log('');

  // ============================================================================
  // CHECK 3: CONTAINER CAPACITY ANALYSIS
  // ============================================================================
  console.log('CHECK 3: CONTAINER CAPACITY ANALYSIS');
  console.log('─'.repeat(90));
  console.log('Standard container capacity = 72 tires (per Ankur)');
  console.log('');

  const allQtys = allData.map(o => o.totalQty).sort((a, b) => b - a);
  const uniqueQtys = [...new Set(allQtys)];

  console.log('All Unique Quantities in Excel:');
  console.log(uniqueQtys.join(', '));
  console.log('');

  const over72 = allData.filter(o => o.totalQty > 72);
  const exactly72 = allData.filter(o => o.totalQty === 72);
  const under72 = allData.filter(o => o.totalQty < 72 && o.totalQty > 0);

  console.log(`Orders with Qty = 72: ${exactly72.length} orders`);
  console.log(`Orders with Qty > 72: ${over72.length} orders (need multiple containers)`);
  console.log(`Orders with Qty < 72: ${under72.length} orders (partial container)`);
  console.log('');

  if (over72.length > 0) {
    console.log('⚠️  Orders with Qty > 72 (cannot fit in one 72-tire container):');
    console.log('SO Number   | Customer PO  | Qty  | Containers Needed | Note');
    console.log('─'.repeat(90));

    over72.forEach(order => {
      const containers = Math.ceil(order.totalQty / 72);
      const note = order.totalQty === 144 ? 'Could be 72 + 72' :
                   order.totalQty === 78 ? 'NOT evenly divisible by 72' :
                   order.totalQty === 96 ? 'NOT evenly divisible by 72' :
                   '';

      console.log(
        String(order.loadNumber).padEnd(11) + ' | ' +
        String(order.po).padEnd(12) + ' | ' +
        String(order.totalQty).padEnd(4) + ' | ' +
        String(containers).padEnd(17) + ' | ' +
        note
      );
    });

    console.log('─'.repeat(90));
    console.log('');
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   KEY FINDINGS                            ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('1️⃣  Ankur said: "144 tires = 72 + 72" (example)');
  console.log('');

  const has144Orders = duplicates.some(([po, orders]) => {
    const total = orders.reduce((sum, o) => sum + o.totalQty, 0);
    return total === 144;
  });

  if (has144Orders) {
    console.log('   ✅ Found PO with 144 total tires split into multiple deliveries');
  } else {
    console.log('   ❌ NO PO with exactly 144 total tires found in Excel');
  }
  console.log('');

  console.log('2️⃣  User question: "પણ બીજા SO માં કેમ 78 અને 96 qty છે?"');
  console.log('');

  const has78 = allData.some(o => o.totalQty === 78);
  const has96 = allData.some(o => o.totalQty === 96);

  if (has78) {
    const qty78Orders = allData.filter(o => o.totalQty === 78);
    console.log(`   ✅ YES! Found ${qty78Orders.length} order(s) with 78 tires:`);
    qty78Orders.forEach(o => {
      console.log(`      - ${o.loadNumber}: PO ${o.po}, Qty = ${o.totalQty}`);
    });
  }

  if (has96) {
    const qty96Orders = allData.filter(o => o.totalQty === 96);
    console.log(`   ✅ YES! Found ${qty96Orders.length} order(s) with 96 tires:`);
    qty96Orders.forEach(o => {
      console.log(`      - ${o.loadNumber}: PO ${o.po}, Qty = ${o.totalQty}`);
    });
  }

  console.log('');
  console.log('3️⃣  Container capacity issue:');
  console.log('');
  console.log('   📦 Standard container = 72 tires');
  console.log('   ⚠️  78 tires = 1 container (72) + 6 tires (overflow)');
  console.log('   ⚠️  96 tires = 1 container (72) + 24 tires (overflow)');
  console.log('');
  console.log('   ℹ️  These orders do NOT fit neatly into 72-tire containers!');
  console.log('');

  console.log('✅ Analysis complete!\n');

} catch (error) {
  console.error('❌ Error reading Excel file:', error.message);
}
