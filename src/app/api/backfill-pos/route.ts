import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import { regeneratePurchaseOrder } from '@/features/sales-orders/actions';

/**
 * Backfill Missing Purchase Orders
 *
 * Creates Purchase Orders for existing Sales Orders that don't have them yet.
 * This is for historical data where POs were not automatically created.
 *
 * Usage: POST /api/backfill-pos
 */
export async function POST(_request: NextRequest) {
  const supabase = createAdminClient();

  console.log('[Backfill POs] Starting...');

  // Get all Sales Orders with GDC order series that don't have POs
  const { data: salesOrders, error: soError } = await supabase
    .from('sales_orders')
    .select('id, order_number, order_series, product_source, status')
    .is('deleted_at', null)
    .in('order_series', ['GDC 0', 'GDC 1', 'GDC 2', 'GDC 3'])
    .eq('product_source', 'direct')
    .in('status', ['confirmed', 'processing', 'shipped', 'delivered'])
    .order('created_at', { ascending: true });

  if (soError) {
    console.error('[Backfill POs] Error fetching SOs:', soError);
    return NextResponse.json({ error: 'Failed to fetch Sales Orders' }, { status: 500 });
  }

  console.log(`[Backfill POs] Found ${salesOrders?.length || 0} Sales Orders`);

  if (!salesOrders || salesOrders.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No Sales Orders found',
      results: []
    });
  }

  const results: {
    salesOrder: string;
    status: 'created' | 'exists' | 'failed';
    poNumber?: string;
    error?: string;
  }[] = [];

  // Check each SO for existing PO
  for (const so of salesOrders) {
    console.log(`\n[Backfill POs] Processing ${so.order_number}...`);

    // Check if PO already exists
    const { data: existingPO } = await supabase
      .from('purchase_orders')
      .select('id, po_number')
      .eq('sales_order_id', so.id)
      .is('deleted_at', null)
      .single();

    if (existingPO) {
      console.log(`[Backfill POs] ✓ PO already exists: ${existingPO.po_number}`);
      results.push({
        salesOrder: so.order_number,
        status: 'exists',
        poNumber: existingPO.po_number
      });
      continue;
    }

    // Create PO
    try {
      const result = await regeneratePurchaseOrder(so.id);

      if (result.success) {
        console.log(`[Backfill POs] ✓ Created PO: ${result.data?.poNumber}`);
        results.push({
          salesOrder: so.order_number,
          status: 'created',
          poNumber: result.data?.poNumber
        });
      } else {
        console.error(`[Backfill POs] ✗ Failed: ${result.error}`);
        results.push({
          salesOrder: so.order_number,
          status: 'failed',
          error: result.error
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Backfill POs] ✗ Exception: ${errorMsg}`);
      results.push({
        salesOrder: so.order_number,
        status: 'failed',
        error: errorMsg
      });
    }

    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const summary = {
    total: results.length,
    created: results.filter(r => r.status === 'created').length,
    exists: results.filter(r => r.status === 'exists').length,
    failed: results.filter(r => r.status === 'failed').length,
  };

  console.log('\n[Backfill POs] Summary:', summary);

  return NextResponse.json({
    success: true,
    summary,
    results
  });
}
