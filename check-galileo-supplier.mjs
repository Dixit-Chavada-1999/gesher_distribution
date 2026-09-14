#!/usr/bin/env node
/**
 * Check if Galileo supplier exists
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

async function checkGalileo() {
  console.log('🔍 Checking for Galileo supplier...\n');

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, supplier_code, contact_email')
    .ilike('name', '%galileo%')
    .is('deleted_at', null);

  if (!suppliers || suppliers.length === 0) {
    console.log('❌ Galileo supplier NOT FOUND!\n');
    console.log('Need to create Galileo supplier first.\n');
  } else {
    console.log('✅ Found ' + suppliers.length + ' supplier(s):\n');
    suppliers.forEach(s => {
      console.log('  ID: ' + s.id);
      console.log('  Name: ' + s.name);
      console.log('  Code: ' + (s.supplier_code || '(not set)'));
      console.log('  Email: ' + (s.contact_email || '(not set)'));
      console.log('');
    });
  }

  return suppliers?.[0] || null;
}

checkGalileo().catch(console.error);
