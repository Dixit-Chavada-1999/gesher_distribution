-- Check Sales Orders with order_series 'GDC 0' that don't have Purchase Orders
SELECT 
  so.order_number as "Sales Order",
  so.order_series as "Order Series",
  so.customer_po_number as "Customer PO",
  so.product_source as "Source",
  CASE 
    WHEN po.id IS NULL THEN 'No PO'
    ELSE 'Has PO'
  END as "PO Status"
FROM sales_orders so
LEFT JOIN purchase_orders po ON so.id = po.sales_order_id AND po.deleted_at IS NULL
WHERE so.order_series = 'GDC 0'
  AND so.deleted_at IS NULL
ORDER BY so.order_number;
