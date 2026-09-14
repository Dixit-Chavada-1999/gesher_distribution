#!/usr/bin/env node
/**
 * COMPREHENSIVE EXCEL vs DATABASE AUDIT
 * Verify ALL fields match exactly
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

const supabase = createClient(supabaseUrl, supabaseKey);

// Expected data from Excel (GDC 0 + GDC 1)
const expectedOrders = {
  // GDC 0 (SO2600023-036)
  'SO2600023': { customerPO: 'PO-2600023', series: 'GDC 0', date: '2026-06-20' },
  'SO2600024': { customerPO: 'Q454878', series: 'GDC 0', date: '2026-06-20' },
  'SO2600025': { customerPO: 'PO-N145669', series: 'GDC 0', date: '2026-06-20' },
  'SO2600026': { customerPO: 'Q454877', series: 'GDC 0', date: '2026-06-29' },
  'SO2600027': { customerPO: 'PO-N145710', series: 'GDC 0', date: '2026-07-07' },
  'SO2600028': { customerPO: 'PO-N145710', series: 'GDC 0', date: '2026-07-05' },
  'SO2600029': { customerPO: 'PO-N145710', series: 'GDC 0', date: '2026-07-05' },
  'SO2600030': { customerPO: 'Q454884', series: 'GDC 0', date: '2026-07-05' },
  'SO2600031': { customerPO: 'PO-N152890', series: 'GDC 0', date: '2026-07-05' },
  'SO2600032': { customerPO: 'PONE-3405', series: 'GDC 0', date: '2026-07-10' },
  'SO2600033': { customerPO: 'PO-N152892', series: 'GDC 0', date: '2026-07-10' },
  'SO2600034': { customerPO: 'Q453893', series: 'GDC 0', date: '2026-07-29' },
  'SO2600035': { customerPO: 'Q458395', series: 'GDC 0', date: '2026-07-29' },
  'SO2600036': { customerPO: 'PO-N153218', series: 'GDC 0', date: '2026-07-22' },

  // GDC 1 (SO2600037-053)
  'SO2600037': { customerPO: 'PO-2600037', series: 'GDC 1', date: '2026-09-16' },
  'SO2600038': { customerPO: 'PO-2600038', series: 'GDC 1', date: '2026-09-18' },
  'SO2600039': { customerPO: 'PO-2600039', series: 'GDC 1', date: '2026-09-22' },
  'SO2600040': { customerPO: 'PO-2600040', series: 'GDC 1', date: '2026-09-24' },
  'SO2600041': { customerPO: 'Q459077', series: 'GDC 1', date: '2026-09-29' },
  'SO2600042': { customerPO: 'Q459074', series: 'GDC 1', date: '2026-09-29' },
  'SO2600043': { customerPO: 'Q455965', series: 'GDC 1', date: '2026-10-01' },
  'SO2600044': { customerPO: 'Q456318', series: 'GDC 1', date: '2026-10-07' },
  'SO2600045': { customerPO: 'PO-N151062', series: 'GDC 1', date: '2026-10-07' },
  'SO2600046': { customerPO: 'PO-N151062', series: 'GDC 1', date: '2026-10-07' },
  'SO2600047': { customerPO: 'PO-N151896', series: 'GDC 1', date: '2026-10-07' },
  'SO2600048': { customerPO: 'PO-N151896', series: 'GDC 1', date: '2026-10-07' },
  'SO2600049': { customerPO: 'PO-2600049', series: 'GDC 1', date: '2026-10-16' },
  'SO2600050': { customerPO: 'PO-2600050', series: 'GDC 1', date: '2026-10-16' },
  'SO2600051': { customerPO: 'PO-2600051', series: 'GDC 1', date: '2026-10-21' },
  'SO2600052': { customerPO: 'PO-2600052', series: 'GDC 1', date: '2026-10-21' },
  'SO2600053': { customerPO: 'PO-2600053', series: 'GDC 1', date: '2026-10-21' },
};

async function comprehensiveAudit() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   COMPREHENSIVE EXCEL vs DATABASE AUDIT                   ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { data: salesOrders } = await supabase
    .from('sales_orders')
    .select(`
      order_number,
      customer_po_number,
      order_series,
      order_date,
      deleted_at
    `)
    .gte('order_number', 'SO2600023')
    .lte('order_number', 'SO2600053')
    .order('order_number');

  console.log('CHECK 1: ALL 30 ORDERS EXIST');
  console.log('─'.repeat(80));

  const expectedCount = Object.keys(expectedOrders).length;
  const actualCount = salesOrders?.filter(so => !so.deleted_at).length || 0;

  console.log(`Expected Orders: ${expectedCount}`);
  console.log(`Found in DB:     ${actualCount}`);
  console.log(`Status:          ${expectedCount === actualCount ? '✅ PASS' : '❌ FAIL'}\n`);

  if (expectedCount !== actualCount) {
    const missing = Object.keys(expectedOrders).filter(
      soNum => !salesOrders?.some(so => so.order_number === soNum && !so.deleted_at)
    );
    console.log('❌ Missing Orders:', missing.join(', '));
    console.log('');
  }

  // ============================================================================
  // CHECK 2: FIELD-BY-FIELD COMPARISON
  // ============================================================================
  console.log('CHECK 2: FIELD-BY-FIELD COMPARISON (Excel vs Database)');
  console.log('─'.repeat(80));

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  const issues = [];

  for (const so of salesOrders || []) {
    if (so.deleted_at) continue; // Skip deleted

    const expected = expectedOrders[so.order_number];
    if (!expected) {
      issues.push(`${so.order_number}: Not in expected data`);
      continue;
    }

    // Check Customer PO
    totalChecks++;
    if (so.customer_po_number === expected.customerPO) {
      passedChecks++;
    } else {
      failedChecks++;
      issues.push(
        `${so.order_number} - Customer PO: Expected "${expected.customerPO}", Got "${so.customer_po_number}"`
      );
    }

    // Check Order Series
    totalChecks++;
    if (so.order_series === expected.series) {
      passedChecks++;
    } else {
      failedChecks++;
      issues.push(
        `${so.order_number} - Order Series: Expected "${expected.series}", Got "${so.order_series}"`
      );
    }

    // Check Date
    totalChecks++;
    const dbDate = so.order_date ? so.order_date.substring(0, 10) : null;
    if (dbDate === expected.date) {
      passedChecks++;
    } else {
      failedChecks++;
      issues.push(
        `${so.order_number} - Order Date: Expected "${expected.date}", Got "${dbDate}"`
      );
    }
  }

  console.log(`Total Field Checks: ${totalChecks}`);
  console.log(`Passed:             ${passedChecks}`);
  console.log(`Failed:             ${failedChecks}`);
  console.log(`Status:             ${failedChecks === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:');
    issues.forEach(issue => console.log('   ' + issue));
    console.log('');
  }

  // ============================================================================
  // CHECK 3: PURCHASE ORDERS MATCH
  // ============================================================================
  console.log('CHECK 3: PURCHASE ORDERS MATCH CUSTOMER PO');
  console.log('─'.repeat(80));

  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select(`
      po_number,
      sales_order_id,
      sales_orders (
        order_number,
        customer_po_number
      )
    `)
    .is('deleted_at', null);

  let poMatches = 0;
  let poMismatches = 0;
  const poIssues = [];

  for (const po of purchaseOrders || []) {
    const soNumber = po.sales_orders?.order_number;
    const customerPO = po.sales_orders?.customer_po_number;

    // Skip if it's a Quote (shouldn't have PO)
    if (customerPO?.startsWith('Q')) {
      poIssues.push(`${soNumber}: Should NOT have PO (it's a Quote: ${customerPO})`);
      poMismatches++;
      continue;
    }

    if (po.po_number === customerPO) {
      poMatches++;
    } else {
      poMismatches++;
      poIssues.push(
        `${soNumber}: PO mismatch - DB has "${po.po_number}", Customer PO is "${customerPO}"`
      );
    }
  }

  console.log(`PO Matches:    ${poMatches}`);
  console.log(`PO Mismatches: ${poMismatches}`);
  console.log(`Status:        ${poMismatches === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  if (poIssues.length > 0) {
    console.log('❌ PO ISSUES:');
    poIssues.forEach(issue => console.log('   ' + issue));
    console.log('');
  }

  // ============================================================================
  // CHECK 4: DUPLICATE CUSTOMER POs (Expected)
  // ============================================================================
  console.log('CHECK 4: DUPLICATE CUSTOMER POs (Should be Allowed)');
  console.log('─'.repeat(80));

  const expectedDuplicates = {
    'PO-N145710': 3,  // SO27, SO28, SO29
    'PO-N151062': 2,  // SO45, SO46
    'PO-N151896': 2,  // SO47, SO48
  };

  for (const [po, expectedCount] of Object.entries(expectedDuplicates)) {
    const count = salesOrders?.filter(
      so => so.customer_po_number === po && !so.deleted_at
    ).length || 0;

    const status = count === expectedCount ? '✅' : '❌';
    console.log(`${po}: Expected ${expectedCount} orders, Found ${count} ${status}`);
  }
  console.log('');

  // ============================================================================
  // CHECK 5: NO 2024 DATES
  // ============================================================================
  console.log('CHECK 5: NO 2024 DATES (All should be 2026)');
  console.log('─'.repeat(80));

  const wrongDates = salesOrders?.filter(
    so => !so.deleted_at && so.order_date?.startsWith('2024')
  ) || [];

  console.log(`Orders with 2024 dates: ${wrongDates.length} (should be 0)`);
  console.log(`Orders with 2026 dates: ${actualCount - wrongDates.length}`);
  console.log(`Status:                 ${wrongDates.length === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

  if (wrongDates.length > 0) {
    console.log('❌ WRONG DATES:');
    wrongDates.forEach(so => {
      console.log(`   ${so.order_number}: ${so.order_date}`);
    });
    console.log('');
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                   FINAL AUDIT SUMMARY                      ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const allChecks = [
    { name: 'All 30 Orders Exist', pass: expectedCount === actualCount },
    { name: 'Field-by-Field Match', pass: failedChecks === 0 },
    { name: 'Purchase Orders Match', pass: poMismatches === 0 },
    { name: 'No 2024 Dates', pass: wrongDates.length === 0 },
  ];

  const passed = allChecks.filter(c => c.pass).length;
  const total = allChecks.length;

  allChecks.forEach((check, i) => {
    console.log(`   ${i + 1}. ${check.name.padEnd(30)} ${check.pass ? '✅ PASS' : '❌ FAIL'}`);
  });

  console.log('');
  console.log(`   TOTAL: ${passed}/${total} checks passed`);
  console.log('');

  if (passed === total) {
    console.log('✅ PERFECT! Excel અને Database એકદમ same છે! 🎉\n');
    console.log('   ✓ All 30 orders imported correctly');
    console.log('   ✓ Customer PO numbers exact match');
    console.log('   ✓ Order series correct (GDC 0 / GDC 1)');
    console.log('   ✓ All dates are 2026');
    console.log('   ✓ Duplicate customer POs allowed');
    console.log('   ✓ Purchase orders match customer POs');
    console.log('');
  } else {
    console.log('⚠️  Some checks failed. Review issues above.\n');
  }

  // ============================================================================
  // DETAILED ORDER LIST
  // ============================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   DETAILED ORDER LIST (All 30 Orders)                     ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('SO Number   | Customer PO  | Series  | Date       | Match?');
  console.log('─'.repeat(75));

  for (const so of salesOrders || []) {
    if (so.deleted_at) continue;

    const expected = expectedOrders[so.order_number];
    const dbDate = so.order_date ? so.order_date.substring(0, 10) : '(null)';

    const poMatch = so.customer_po_number === expected?.customerPO;
    const seriesMatch = so.order_series === expected?.series;
    const dateMatch = dbDate === expected?.date;
    const allMatch = poMatch && seriesMatch && dateMatch;

    const status = allMatch ? '✅' : '❌';

    console.log(
      so.order_number + '   | ' +
      (so.customer_po_number || '(none)').padEnd(12) + ' | ' +
      (so.order_series || '(none)').padEnd(7) + ' | ' +
      dbDate.padEnd(10) + ' | ' +
      status
    );
  }

  console.log('─'.repeat(75));
  console.log('');
}

comprehensiveAudit().catch(console.error);
