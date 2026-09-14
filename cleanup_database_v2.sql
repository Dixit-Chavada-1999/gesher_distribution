-- ============================================
-- DATABASE CLEANUP SCRIPT V2 - Complete Fresh Start
-- ============================================
-- PURPOSE: Clean ALL data (including customers) for fresh GDC import
-- DATE: September 10, 2026
--
-- આ script બધું જ delete કરશે customers સહિત!
--
-- ⚠️ IMPORTANT - BEFORE RUNNING:
-- 1. Database backup લો: pg_dump -h host -U user dbname > backup_$(date +%Y%m%d).sql
-- 2. Test database પર પહેલા test કરો
-- 3. Verify Migration 110 applied (relaxed SO number format)
--
-- 💡 NOTE: Script runs silently. Success/error messages shown at the end.
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: DELETE TRANSACTIONAL DATA
-- ============================================

-- Invoice chain
DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices);
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices);
DELETE FROM invoices;

-- Credit notes
DELETE FROM credit_note_items WHERE credit_note_id IN (SELECT id FROM credit_notes);
DELETE FROM credit_notes;

-- Pick tickets & packing lists
DELETE FROM packing_list_items;
DELETE FROM packing_lists;
DELETE FROM pick_ticket_items;
DELETE FROM pick_tickets;

-- Shipments
DELETE FROM shipment_status_history;
DELETE FROM shipment_items;
DELETE FROM shipments;
DELETE FROM shipping_emails;

-- Inventory
DELETE FROM inventory_movements;
DELETE FROM inventory;

-- Sales orders
DELETE FROM sales_order_items;
DELETE FROM sales_orders;

-- Purchase orders
DELETE FROM purchase_order_items;
DELETE FROM purchase_orders;

-- Quotes
DELETE FROM quote_items;
DELETE FROM quotes;

-- Pricing & costs
DELETE FROM cost_components;
DELETE FROM price_matrix;

-- Documents & emails
DELETE FROM inbound_email_attachments;
DELETE FROM inbound_emails;
DELETE FROM po_extractions;
DELETE FROM attachments;

-- CRM data
UPDATE leads SET converted_deal_id = NULL WHERE converted_deal_id IS NOT NULL;
UPDATE deals SET lead_id = NULL WHERE lead_id IS NOT NULL;
DELETE FROM deal_activities;
DELETE FROM deal_notes;
DELETE FROM deals;
DELETE FROM lead_notes;
DELETE FROM leads;
DELETE FROM pipedrive_sync_log;

-- Other
DELETE FROM approval_events;
DELETE FROM notification_recipients;
DELETE FROM notifications;

-- ============================================
-- STEP 2: DELETE MASTER DATA (તમે માંગ્યું!)
-- ============================================

-- Customers (આ અનકોમેન્ટ છે - DELETE થશે!)
DELETE FROM customer_documents;
DELETE FROM customer_contacts;
DELETE FROM customers;

-- Products (આ પણ DELETE થશે!)
DELETE FROM products;

-- ⚠️ Locations - COMMENTED OUT (warehouses keep કરવાના!)
-- આ uncomment નહીં કરતા unless તમે warehouses પણ delete કરવા માંગતા હો
-- DELETE FROM location_contacts;
-- DELETE FROM locations;

-- ⚠️ Suppliers - COMMENTED OUT
-- DELETE FROM suppliers;

-- ============================================
-- STEP 3: WHAT WE'RE KEEPING
-- ============================================
-- ✅ users (at least superadmin)
-- ✅ roles
-- ✅ permissions
-- ✅ role_permissions
-- ✅ locations (warehouses needed!)
-- ✅ suppliers
-- ✅ chart_of_accounts
-- ✅ integrations
-- ✅ audit_logs (optional - uncomment below to delete)

-- DELETE FROM audit_logs;  -- Uncomment to clean audit trail

-- ============================================
-- STEP 4: RESET AUTO-INCREMENT SEQUENCES
-- ============================================
-- આ uncomment કરો only if તમે numbers 1 થી start કરવા માંગતા હો

-- ALTER SEQUENCE quote_number_seq RESTART WITH 1;
-- ALTER SEQUENCE sales_order_number_seq RESTART WITH 1;
-- ALTER SEQUENCE invoice_number_seq RESTART WITH 1;

-- ⚠️ NOTE: Historical imports use MANUAL numbers:
--    - Quotes: QT2600023, QT2600024, etc.
--    - Sales Orders: SO2600023, SO2600024, etc.
-- Future auto-generated will use format:
--    - Quotes: QT-2026-00001
--    - Sales Orders: SO-2026-00001
-- Sequences NOT needed to reset!

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '╔═══════════════════════════════════════╗' as title
UNION ALL SELECT '║  CLEANUP VERIFICATION REPORT        ║'
UNION ALL SELECT '╚═══════════════════════════════════════╝';

-- Count records in key tables
SELECT
  table_name,
  record_count,
  CASE
    WHEN table_name IN ('customers', 'products', 'sales_orders', 'quotes', 'invoices', 'shipments', 'inventory')
      AND record_count = 0 THEN '✅ Empty (ready for import)'
    WHEN table_name IN ('locations', 'users', 'roles')
      AND record_count > 0 THEN '✅ Preserved (system data)'
    WHEN table_name IN ('customers', 'products') AND record_count > 0 THEN '⚠️ Still has data!'
    ELSE '✅ OK'
  END as status
FROM (
  SELECT 'customers' as table_name, COUNT(*)::int as record_count FROM customers
  UNION ALL SELECT 'products', COUNT(*)::int FROM products
  UNION ALL SELECT 'sales_orders', COUNT(*)::int FROM sales_orders
  UNION ALL SELECT 'quotes', COUNT(*)::int FROM quotes
  UNION ALL SELECT 'invoices', COUNT(*)::int FROM invoices
  UNION ALL SELECT 'shipments', COUNT(*)::int FROM shipments
  UNION ALL SELECT 'inventory', COUNT(*)::int FROM inventory
  UNION ALL SELECT 'pick_tickets', COUNT(*)::int FROM pick_tickets
  UNION ALL SELECT 'locations', COUNT(*)::int FROM locations
  UNION ALL SELECT 'users', COUNT(*)::int FROM users
  UNION ALL SELECT 'roles', COUNT(*)::int FROM roles
) t
ORDER BY table_name;

-- ============================================
-- PRE-INGESTION VALIDATION
-- ============================================

SELECT '╔═══════════════════════════════════════╗' as title
UNION ALL SELECT '║  PRE-INGESTION CHECKS               ║'
UNION ALL SELECT '╚═══════════════════════════════════════╝';

-- Check 1: Migration 110 (Order number format)
SELECT
  '1. Sales Order Number Format' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'sales_orders'::regclass
        AND conname = 'sales_orders_number_not_empty'
    ) THEN '✅ Migration 110 applied - ANY format allowed'
    ELSE '❌ Migration 110 NOT applied - RUN IT FIRST!'
  END as status;

-- Check 2: Migration 091 (Quote number format)
SELECT
  '2. Quote Number Format' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'quotes'::regclass
        AND conname = 'quotes_number_not_empty'
    ) THEN '✅ Migration 091 applied - ANY format allowed'
    ELSE '⚠️ Check quote constraint (should be relaxed)'
  END as status;

-- Check 3: Warehouse locations
SELECT
  '3. Warehouse Locations' as check_item,
  CASE
    WHEN (SELECT COUNT(*) FROM locations WHERE location_type = 'warehouse' AND deleted_at IS NULL) >= 2
    THEN '✅ ' || (SELECT COUNT(*) FROM locations WHERE location_type = 'warehouse')::text || ' warehouses exist'
    WHEN (SELECT COUNT(*) FROM locations WHERE location_type = 'warehouse' AND deleted_at IS NULL) = 1
    THEN '⚠️ Only 1 warehouse - need Nebraska & Kansas'
    ELSE '❌ No warehouses! Need to create locations first'
  END as status;

-- Check 4: Superadmin user
SELECT
  '4. Superadmin User' as check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM users WHERE email LIKE '%superadmin%' AND deleted_at IS NULL)
    THEN '✅ Superadmin exists'
    ELSE '❌ No superadmin found!'
  END as status;

-- Check 5: Clean slate check
SELECT
  '5. Data Tables Clean' as check_item,
  CASE
    WHEN (SELECT SUM(cnt) FROM (
      SELECT COUNT(*) as cnt FROM customers
      UNION ALL SELECT COUNT(*) FROM products
      UNION ALL SELECT COUNT(*) FROM sales_orders
      UNION ALL SELECT COUNT(*) FROM quotes
    ) t) = 0
    THEN '✅ All data tables empty - ready for import'
    ELSE '⚠️ Some tables still have data'
  END as status;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║                                                ║';
  RAISE NOTICE '║  ✅  DATABASE CLEANUP COMPLETE!                ║';
  RAISE NOTICE '║                                                ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  DELETED:';
  RAISE NOTICE '   ├─ All customers (including existing ones)';
  RAISE NOTICE '   ├─ All products';
  RAISE NOTICE '   ├─ All sales orders';
  RAISE NOTICE '   ├─ All quotes';
  RAISE NOTICE '   ├─ All invoices';
  RAISE NOTICE '   ├─ All shipments';
  RAISE NOTICE '   └─ All inventory records';
  RAISE NOTICE '';
  RAISE NOTICE '✅ PRESERVED:';
  RAISE NOTICE '   ├─ Users (including superadmin)';
  RAISE NOTICE '   ├─ Roles & Permissions';
  RAISE NOTICE '   ├─ Warehouse Locations';
  RAISE NOTICE '   └─ System configuration';
  RAISE NOTICE '';
  RAISE NOTICE '📊 READY FOR DATA INGESTION:';
  RAISE NOTICE '   ├─ 33 historical sales orders (SO2600023-SO2600053)';
  RAISE NOTICE '   ├─ 6 customers (Valley, Lindsay, WISH, etc.)';
  RAISE NOTICE '   ├─ 2-3 products (38" tire, 24" tire, service)';
  RAISE NOTICE '   └─ 46 customer PO documents (PDFs)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '   1. Verify Migration 110 is applied ✓';
  RAISE NOTICE '   2. Check warehouse locations exist ✓';
  RAISE NOTICE '   3. Review data ingestion plan';
  RAISE NOTICE '   4. Run data ingestion script';
  RAISE NOTICE '';
END $$;

-- ============================================
-- OPTIONAL: VACUUM & ANALYZE
-- ============================================
-- Run separately after commit (cannot run in transaction):
--
-- VACUUM FULL ANALYZE;
--
-- This will:
-- - Reclaim disk space from deleted rows
-- - Update statistics for query planner
-- - Improve database performance
--
-- WARNING: VACUUM FULL locks tables - run during maintenance window!
-- ============================================
