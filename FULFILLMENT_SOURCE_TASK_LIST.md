# FULFILLMENT SOURCE IMPLEMENTATION - TASK LIST

Based on Jenny's email clarification (Business Flow Changes)

---

## PHASE 1: CLARIFICATION & PLANNING

- [ ] 1.1 Send clarification email to Jenny & Ankur
- [ ] 1.2 Get confirmation on Platinum Dealers module scope
- [ ] 1.3 Clarify when fulfillment source is selected (workflow)
- [ ] 1.4 Confirm container qty tracking location (SO/PO level)
- [ ] 1.5 Get approval on removal of auto-split functionality

---

## PHASE 2: DATABASE CHANGES

- [ ] 2.1 Create new enum `fulfillment_source` (4 types: manufacturer, gdc_inventory, platinum_dealer_inventory, platinum_dealer_fulfillment)
- [ ] 2.2 Add fulfillment columns to `sales_order_items` table (fulfillment_source, fulfillment_location_id, container_qty, remaining_qty)
- [ ] 2.3 Create `platinum_dealers` table
- [ ] 2.4 Create `platinum_dealer_inventory` table
- [ ] 2.5 Create data migration script (convert old product_source to new fulfillment_source)

---

## PHASE 3: TYPE SYSTEM UPDATES

- [ ] 3.1 Update `FulfillmentSource` type (replace ProductSource)
- [ ] 3.2 Update `SalesOrderItem` interface (add fulfillment fields)
- [ ] 3.3 Update Zod schemas (add fulfillment fields validation)
- [ ] 3.4 Create Platinum Dealer types/interfaces
- [ ] 3.5 Update global constants (FULFILLMENT_SOURCES)

---

## PHASE 4: REMOVE AUTO-SPLIT FUNCTIONALITY

- [ ] 4.1 Delete `MultiItemSplitDialog.tsx` component
- [ ] 4.2 Delete `SplitOrderDialog.tsx` component
- [ ] 4.3 Remove split logic from Quote → SO conversion (quotes-content.tsx lines 644-979)
- [ ] 4.4 Remove container capacity checks at SO level
- [ ] 4.5 Simplify `convertQuoteToSalesOrder` action (1:1 conversion)
- [ ] 4.6 Remove split-related state variables from quotes-content.tsx
- [ ] 4.7 Remove MultiItemSplitDialog export from components/index.ts

---

## PHASE 5: PLATINUM DEALERS MODULE (NEW)

- [ ] 5.1 Create Platinum Dealers repository (database queries)
- [ ] 5.2 Create Platinum Dealers service (business logic)
- [ ] 5.3 Create Platinum Dealers server actions
- [ ] 5.4 Create PlatinumDealersTable component
- [ ] 5.5 Create CreatePlatinumDealerDrawer component
- [ ] 5.6 Create ViewPlatinumDealerDrawer component
- [ ] 5.7 Create DealerInventoryTable component
- [ ] 5.8 Create Platinum Dealers page (main UI)
- [ ] 5.9 Add Platinum Dealers to sidebar navigation

---

## PHASE 6: UPDATE SALES ORDER UI

- [ ] 6.1 Update SalesOrderInfoSection - Replace Product Source dropdown with Fulfillment Source (4 options)
- [ ] 6.2 Add Fulfillment Location selector (conditional based on source)
- [ ] 6.3 Update OrderItemsTable - Add columns: Fulfillment Source, Container Qty, Remaining Qty
- [ ] 6.4 Update ViewSalesOrderDrawer - Show fulfillment details per item
- [ ] 6.5 Update SalesOrdersTableColumns - Replace Product Source with Fulfillment Source
- [ ] 6.6 Remove inline Product Source edit logic
- [ ] 6.7 Update CreateSalesOrderDrawer with new fields

---

## PHASE 7: UPDATE OPERATIONS DASHBOARD

- [ ] 7.1 Add Fulfillment Source column to GDC tables
- [ ] 7.2 Add Container Qty column (full container qty)
- [ ] 7.3 Add Customer Qty column (allocated qty)
- [ ] 7.4 Add Remaining Qty column (available qty)
- [ ] 7.5 Add Fulfillment Location column (dealer/warehouse name)
- [ ] 7.6 Update dashboard filters (add fulfillment source filter)
- [ ] 7.7 Update GDC1InventoryTable.tsx
- [ ] 7.8 Update ShipmentOverviewTable.tsx
- [ ] 7.9 Update operations dashboard repository/service queries

---

## PHASE 8: UPDATE INVENTORY MODULE

- [ ] 8.1 Add Platinum Dealer Inventory view/section
- [ ] 8.2 Implement remaining container inventory tracking (auto-add to GDC)
- [ ] 8.3 Update inventory allocation logic (consider fulfillment source)
- [ ] 8.4 Add inventory movement tracking for dealer → customer
- [ ] 8.5 Update InventoryTable to show fulfillment source breakdown

---

## PHASE 9: UPDATE ACTIONS & SERVICES

- [ ] 9.1 Update sales-order.repository.ts (add fulfillment fields to queries)
- [ ] 9.2 Update sales-order.service.ts (handle fulfillment logic)
- [ ] 9.3 Update quote conversion service (remove split logic)
- [ ] 9.4 Create platinum-dealer.repository.ts
- [ ] 9.5 Create platinum-dealer.service.ts
- [ ] 9.6 Update inventory.service.ts (dealer inventory integration)

---

## PHASE 10: TESTING

- [ ] 10.1 Test Quote → SO conversion (verify NO split, 1:1 conversion)
- [ ] 10.2 Test SO creation with manufacturer fulfillment (verify container qty tracking)
- [ ] 10.3 Test SO creation with GDC inventory fulfillment
- [ ] 10.4 Test SO creation with Platinum Dealer inventory fulfillment
- [ ] 10.5 Test SO creation with Platinum Dealer fulfillment (dealer sources)
- [ ] 10.6 Test multi-product SO with different fulfillment sources per item
- [ ] 10.7 Test remaining qty auto-adds to GDC inventory
- [ ] 10.8 Test Operations Dashboard displays all new columns correctly
- [ ] 10.9 Test Platinum Dealers CRUD operations
- [ ] 10.10 Test Platinum Dealer inventory tracking

---

## FILES TO DELETE

```
src/features/quotes/components/MultiItemSplitDialog.tsx
src/features/sales-orders/components/SplitOrderDialog.tsx
```

---

## FILES TO CREATE (NEW)

```
# Database Migrations
supabase/migrations/XXX_fulfillment_source_enum.sql
supabase/migrations/XXX_sales_order_items_fulfillment_fields.sql
supabase/migrations/XXX_platinum_dealers_table.sql
supabase/migrations/XXX_platinum_dealer_inventory_table.sql
supabase/migrations/XXX_migrate_product_source_data.sql

# Platinum Dealers Module
src/features/platinum-dealers/types/index.ts
src/features/platinum-dealers/repositories/platinum-dealer.repository.ts
src/features/platinum-dealers/services/platinum-dealer.service.ts
src/features/platinum-dealers/actions/index.ts
src/features/platinum-dealers/components/PlatinumDealersTable.tsx
src/features/platinum-dealers/components/PlatinumDealersTableColumns.tsx
src/features/platinum-dealers/components/CreatePlatinumDealerDrawer.tsx
src/features/platinum-dealers/components/ViewPlatinumDealerDrawer.tsx
src/features/platinum-dealers/components/DealerInventoryTable.tsx
src/features/platinum-dealers/components/index.ts
src/app/(dashboard)/platinum-dealers/page.tsx
src/app/(dashboard)/platinum-dealers/platinum-dealers-content.tsx
```

---

## FILES TO MODIFY (MAJOR CHANGES)

```
# Type System
src/features/sales-orders/types/index.ts (ProductSource → FulfillmentSource)
src/features/sales-orders/lib/schemas.ts (add fulfillment fields)

# Quote Conversion
src/app/(dashboard)/quotes/quotes-content.tsx (remove lines 644-979, simplify conversion)
src/features/quotes/actions/index.ts (simplify convertQuoteToSalesOrder)
src/features/quotes/components/index.ts (remove MultiItemSplitDialog export)

# Sales Orders
src/features/sales-orders/components/SalesOrderInfoSection.tsx (fulfillment source dropdown)
src/features/sales-orders/components/OrderItemsTable.tsx (add fulfillment columns)
src/features/sales-orders/components/ViewSalesOrderDrawer.tsx (show fulfillment details)
src/features/sales-orders/components/SalesOrdersTableColumns.tsx (replace product source)
src/features/sales-orders/components/SalesOrdersTable.tsx (update columns)
src/features/sales-orders/repositories/sales-order.repository.ts (add fulfillment fields)
src/features/sales-orders/services/sales-order.service.ts (fulfillment logic)

# Operations Dashboard
src/features/operations-dashboard/components/GDC1InventoryTable.tsx (add columns)
src/features/operations-dashboard/components/ShipmentOverviewTable.tsx (add columns)
src/features/operations-dashboard/repositories/index.ts (update queries)
src/features/operations-dashboard/services/index.ts (fulfillment logic)

# Inventory
src/features/inventory/services/inventory.service.ts (dealer inventory integration)
src/features/inventory/components/InventoryTable.tsx (fulfillment breakdown)
```

---

## ESTIMATED EFFORT

- **Phase 1 (Planning):** 0.5 day (clarifications with client)
- **Phase 2 (Database):** 0.5 day (migrations)
- **Phase 3 (Types):** 0.5 day (TypeScript updates)
- **Phase 4 (Remove Split):** 0.5 day (cleanup)
- **Phase 5 (Platinum Dealers):** 1.5 days (new module)
- **Phase 6 (SO UI):** 1 day (UI updates)
- **Phase 7 (Dashboard):** 1 day (operations dashboard)
- **Phase 8 (Inventory):** 0.5 day (inventory updates)
- **Phase 9 (Services):** 0.5 day (backend logic)
- **Phase 10 (Testing):** 1 day (comprehensive testing)

**Total:** ~7-8 days of development

---

## KEY CHANGES SUMMARY

**BEFORE:**
- Customer orders 100 tires
- Quote → SO creates 2 SOs: 72 + 28 (auto-split by container)
- 2 fulfillment sources: 'direct' or 'warehouse'

**AFTER:**
- Customer orders 100 tires
- Quote → SO creates 1 SO: 100 (no split)
- 4 fulfillment sources: manufacturer, GDC inventory, dealer inventory, dealer fulfillment
- Container qty (72) vs Customer qty (100) tracked separately
- Remaining qty (52) shows as available inventory
- Platinum Dealers module for dealer management

---

## NEXT STEPS

1. Send clarification email to Jenny & Ankur
2. Wait for approval and clarifications
3. Start Phase 2 (Database migrations)
4. Proceed phase by phase

---

**Document Created:** 2026-09-14
**Status:** Pending client approval
