import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPONumbers() {
  // Check if PO-2026-00015 to PO-2026-00027 exist
  const poNumbers = [];
  for (let i = 15; i <= 27; i++) {
    poNumbers.push(`PO-2026-${String(i).padStart(5, '0')}`);
  }

  const { data: pos, error } = await supabase
    .from('purchase_orders')
    .select('po_number, order_series, status, deleted_at')
    .in('po_number', poNumbers);

  console.log('=== Checking PO Numbers 15-27 ===');
  console.log(`Found: ${pos?.length || 0}\n`);

  if (pos && pos.length > 0) {
    pos.forEach(po => {
      console.log(`${po.po_number}: order_series='${po.order_series}', status=${po.status}, deleted=${!!po.deleted_at}`);
    });
  } else {
    console.log('None of these PO numbers exist in database!');
    console.log('\nThis means the INSERT failed silently during script execution.');
  }

  // Check what the highest PO number is
  const { data: lastPO } = await supabase
    .from('purchase_orders')
    .select('po_number, order_series')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log(`\nLast PO created: ${lastPO?.po_number} (${lastPO?.order_series})`);
}

checkPONumbers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
