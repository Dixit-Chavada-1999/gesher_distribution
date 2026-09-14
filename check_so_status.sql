-- Check why POs are not created for GDC 0 Sales Orders
SELECT 
  so.order_number as "SO #",
  so.status as "Status",
  so.product_source as "Product Source",
  so.customer_po_number as "Customer PO",
  CASE 
    WHEN po.id IS NULL THEN '❌ No PO'
    ELSE '✅ Has PO: ' || po.po_number
  END as "PO Status",
  CASE 
    WHEN so.status != 'confirmed' THEN '⚠️ Not Confirmed'
    WHEN so.product_source = 'warehouse' THEN '⚠️ Warehouse Order (No PO needed)'
    WHEN po.id IS NOT NULL THEN '✅ OK'
    ELSE '❓ Should have PO but missing'
  END as "Reason"
FROM sales_orders so
LEFT JOIN purchase_orders po ON so.id = po.sales_order_id AND po.deleted_at IS NULL
WHERE so.order_series = 'GDC 0'
  AND so.deleted_at IS NULL
ORDER BY so.order_number;
