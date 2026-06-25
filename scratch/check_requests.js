const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
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
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runQuery() {
  const { data, error } = await supabase
    .from("access_requests")
    .select(`
      *,
      clients (
        org_name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error('ERROR OBJECT:', error);
    console.error('ERROR MESSAGE:', error.message);
  } else {
    console.log('SUCCESS, DATA LENGTH:', data.length);
  }
}

runQuery();
