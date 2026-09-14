-- ============================================
-- DATABASE CLEANUP SCRIPT - Data Ingestion Preparation
-- PURPOSE: Clean up test/old data before importing historical GDC orders
-- WARNING: This will PERMANENTLY delete all data!
-- ============================================
--
-- 📋 WHAT THIS SCRIPT DOES:
-- ✅ Deletes all transactional data (orders, quotes, invoices, shipments, etc.)
-- ✅ Deletes test users (keeps superadmin only)
-- ✅ PRESERVES: Customers, Products, Locations, Suppliers (for data ingestion)
-- ✅ PRESERVES: Roles, Permissions (system config)
-- ✅ Resets sequences to start from 1
--
-- ⚠️ BEFORE RUNNING:
-- 1. Create database backup: pg_dump > backup.sql
-- 2. Review each DELETE statement
-- 3. Uncomment customers/products DELETE if you want fresh import
-- 4. Test on staging/test database first
--
-- ============================================

-- Start transaction
BEGIN;

-- ============================================
-- STEP 1: Store superadmin user IDs
-- ============================================

DO $$
DECLARE
  v_superadmin_auth_id UUID;
  v_superadmin_user_id UUID;
  v_superadmin_role_id UUID;
BEGIN
  -- Get superadmin auth user ID
  SELECT id INTO v_superadmin_auth_id
  FROM auth.users
  WHERE email = 'superadmin@gmail.com';

  -- Get superadmin application user ID
  SELECT id INTO v_superadmin_user_id
  FROM users
  WHERE email = 'superadmin@gmail.com'
    AND deleted_at IS NULL;

  -- Get super_admin role ID
  SELECT id INTO v_superadmin_role_id
  FROM roles
  WHERE name = 'super_admin'
    AND deleted_at IS NULL;

  -- Store in temp table for reference
  CREATE TEMP TABLE temp_superadmin_ids (
    auth_user_id UUID,
    user_id UUID,
    role_id UUID
  );

  INSERT INTO temp_superadmin_ids VALUES (
    v_superadmin_auth_id,
    v_superadmin_user_id,
    v_superadmin_role_id
  );

  RAISE NOTICE 'Superadmin IDs stored: auth_id=%, user_id=%, role_id=%',
    v_superadmin_auth_id, v_superadmin_user_id, v_superadmin_role_id;
END $$;

-- ============================================
-- STEP 2: Delete from child tables first (respect FK constraints)
-- ============================================

-- Notification recipients (except superadmin's)
DELETE FROM notification_recipients
WHERE user_id NOT IN (SELECT user_id FROM temp_superadmin_ids);

-- Notifications (except created by superadmin)
DELETE FROM notifications
WHERE created_by NOT IN (SELECT user_id FROM temp_superadmin_ids)
   OR created_by IS NULL;

-- Clear FK constraints between leads and deals first
UPDATE leads SET converted_deal_id = NULL WHERE converted_deal_id IS NOT NULL;
UPDATE deals SET lead_id = NULL WHERE lead_id IS NOT NULL;

-- Deal activities and notes (CASCADE will delete these automatically, but explicit for clarity)
DELETE FROM deal_activities WHERE deal_id IN (SELECT id FROM deals);
DELETE FROM deal_notes WHERE deal_id IN (SELECT id FROM deals);
DELETE FROM deals;

-- Lead notes
DELETE FROM lead_notes WHERE lead_id IN (SELECT id FROM leads);
DELETE FROM leads;

-- Pipedrive sync log
DELETE FROM pipedrive_sync_log;

-- Approval events
DELETE FROM approval_events;

-- Audit logs (except superadmin's)
DELETE FROM audit_logs
WHERE user_id NOT IN (SELECT user_id FROM temp_superadmin_ids);

-- Attachments
DELETE FROM attachments;

-- Document types
DELETE FROM document_types;

-- Inbound email attachments
DELETE FROM inbound_email_attachments WHERE email_id IN (SELECT id FROM inbound_emails);
DELETE FROM inbound_emails;

-- PO extractions
DELETE FROM po_extractions;

-- Integration sync logs
DELETE FROM integration_sync_logs
WHERE connection_id IN (SELECT id FROM integration_connections);

-- Integration connections
DELETE FROM integration_connections;

-- Location contacts
DELETE FROM location_contacts;

-- User sessions (except superadmin's)
DELETE FROM user_sessions
WHERE user_id NOT IN (SELECT user_id FROM temp_superadmin_ids);

-- Inventory movements
DELETE FROM inventory_movements;

-- Inventory
DELETE FROM inventory;

-- Shipment status history
DELETE FROM shipment_status_history WHERE shipment_id IN (SELECT id FROM shipments);

-- Shipment items
DELETE FROM shipment_items WHERE shipment_id IN (SELECT id FROM shipments);

-- Shipments
DELETE FROM shipments;

-- Shipping emails
DELETE FROM shipping_emails;

-- Packing list items
DELETE FROM packing_list_items WHERE packing_list_id IN (SELECT id FROM packing_lists);

-- Packing lists
DELETE FROM packing_lists;

-- Pick ticket items
DELETE FROM pick_ticket_items WHERE pick_ticket_id IN (SELECT id FROM pick_tickets);

-- Pick tickets
DELETE FROM pick_tickets;

-- Invoice payments
DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices);

-- Invoice items
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices);

-- Invoices
DELETE FROM invoices;

-- Credit note items
DELETE FROM credit_note_items WHERE credit_note_id IN (SELECT id FROM credit_notes);

-- Credit notes
DELETE FROM credit_notes;

-- Cost components
DELETE FROM cost_components;

-- Sales order items
DELETE FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders);

-- Sales orders
DELETE FROM sales_orders;

-- Purchase order items
DELETE FROM purchase_order_items WHERE purchase_order_id IN (SELECT id FROM purchase_orders);

-- Purchase orders
DELETE FROM purchase_orders;

-- Quote items
DELETE FROM quote_items WHERE quote_id IN (SELECT id FROM quotes);

-- Quotes
DELETE FROM quotes;

-- Price matrix
DELETE FROM price_matrix;

-- Customer documents
DELETE FROM customer_documents WHERE customer_id IN (SELECT id FROM customers);

-- Customer contacts
DELETE FROM customer_contacts WHERE customer_id IN (SELECT id FROM customers);

-- Customers
-- DELETE FROM customers;  -- COMMENTED OUT: Preserve existing customers OR start fresh

-- Products
-- DELETE FROM products;  -- COMMENTED OUT: Preserve existing products OR start fresh

-- Suppliers
-- DELETE FROM suppliers;  -- COMMENTED OUT: May need to preserve suppliers

-- Locations (IMPORTANT: Keep warehouses for data ingestion!)
-- DELETE FROM locations;  -- COMMENTED OUT: Keep warehouse locations (Nebraska, Kansas, etc.)

-- Chart of accounts
DELETE FROM chart_of_accounts;

-- ============================================
-- STEP 3: Clean up users (except superadmin)
-- ============================================

-- Delete non-superadmin users
DELETE FROM users
WHERE id NOT IN (SELECT user_id FROM temp_superadmin_ids);

-- Delete non-superadmin auth identities
DELETE FROM auth.identities
WHERE user_id NOT IN (SELECT auth_user_id FROM temp_superadmin_ids);

-- Delete non-superadmin auth users
DELETE FROM auth.users
WHERE id NOT IN (SELECT auth_user_id FROM temp_superadmin_ids);

-- ============================================
-- STEP 4: Clean up RBAC (keep only super_admin role and system permissions)
-- ============================================

-- Delete role permissions for non-super_admin roles
DELETE FROM role_permissions
WHERE role_id NOT IN (SELECT role_id FROM temp_superadmin_ids);

-- Delete non-system roles
DELETE FROM roles
WHERE id NOT IN (SELECT role_id FROM temp_superadmin_ids)
AND is_system_role = FALSE;

-- Note: Keep all permissions as they are system-level
-- Note: Keep integrations table as it's config data

-- ============================================
-- STEP 5: Reset sequences
-- ============================================

-- Reset auto-increment sequences
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE 'ALTER SEQUENCE ' || r.sequence_name || ' RESTART WITH 1';
  END LOOP;
END $$;

-- ============================================
-- STEP 6: Clean up temp table
-- ============================================

DROP TABLE temp_superadmin_ids;

-- ============================================
-- STEP 7: Vacuum and analyze
-- ============================================

-- Note: VACUUM cannot run inside a transaction block
-- Run these commands separately after committing:
-- VACUUM FULL;
-- ANALYZE;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify superadmin still exists
SELECT 'Superadmin user:' as check_type, email, first_name, last_name, status
FROM users
WHERE email = 'superadmin@gmail.com';

-- Count remaining records in key tables
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
SELECT 'permissions', COUNT(*) FROM permissions
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales_orders', COUNT(*) FROM sales_orders
UNION ALL
SELECT 'quotes', COUNT(*) FROM quotes
UNION ALL
SELECT 'purchase_orders', COUNT(*) FROM purchase_orders
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
ORDER BY table_name;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT
  '✅ Database cleanup completed successfully!' as status,
  'All data deleted except: superadmin user, customers, products, locations' as message;

-- ============================================
-- POST-CLEANUP CHECKLIST (Before Data Ingestion)
-- ============================================

-- 1. Verify Migration 110 is applied (relaxed order number format)
SELECT constraint_name, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'sales_orders'::regclass
  AND conname LIKE '%number%';
-- Expected: sales_orders_number_not_empty (NOT sales_orders_number_format)

-- 2. Check locations exist (warehouses needed for ingestion)
SELECT location_code, name, location_type, city, state
FROM locations
WHERE deleted_at IS NULL
ORDER BY location_code;
-- Expected: Nebraska Warehouse, Kansas Warehouse, etc.

-- 3. Check if any customers/products exist
SELECT
  (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) as customer_count,
  (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) as product_count;
-- If 0: Will create new during ingestion
-- If > 0: Will match existing by EIN (customers) or SKU (products)

-- 4. Verify quote number format is relaxed (Migration 091)
SELECT constraint_name, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'quotes'::regclass
  AND conname LIKE '%number%';
-- Expected: quotes_number_not_empty (allows any format)

-- ============================================
-- READY FOR DATA INGESTION!
-- ============================================
-- Next step: Run data ingestion script to import:
-- - 33 historical sales orders (SO2600023 - SO2600053)
-- - 6 customers (Valley, Lindsay, WISH, etc.)
-- - 2-3 products (38" tire, 24" tire, commission service)
-- - Customer PO documents (46 PDFs)
-- ============================================
