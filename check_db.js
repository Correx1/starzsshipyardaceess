const fs = require('fs');
const path = require('path');
const { createClient } = require('./node_modules/@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
console.log('Reading env from:', envPath);

let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  console.error('Failed to read .env.local:', err.message);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('\n--- Checking Tables ---');

  // Check clients
  try {
    const { data, error } = await supabase.from('clients').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('❌ clients table error:', error.message);
    } else {
      console.log('✅ clients table exists. Row count:', data ? data[0]?.count || 0 : 0);
    }
  } catch (err) {
    console.error('❌ clients table failed:', err.message);
  }

  // Check access_requests
  try {
    const { data, error } = await supabase.from('access_requests').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('❌ access_requests table error:', error.message);
    } else {
      console.log('✅ access_requests table exists. Row count:', data ? data[0]?.count || 0 : 0);
    }
  } catch (err) {
    console.error('❌ access_requests table failed:', err.message);
  }

  // Check admin_settings
  try {
    const { data, error } = await supabase.from('admin_settings').select('*');
    if (error) {
      console.error('❌ admin_settings table error:', error.message);
    } else {
      console.log('✅ admin_settings table exists. Rows:', data);
    }
  } catch (err) {
    console.error('❌ admin_settings table failed:', err.message);
  }
}

checkTables();
