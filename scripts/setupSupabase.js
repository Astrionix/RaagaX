require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setup() {
  console.log('Setting up Supabase Schema for RaagaX Discovery...');

  // Since we can't run raw DDL via standard JS client, we'll use an RPC if available,
  // or we'll just check if we can query the 'canonical_songs' table to see if it exists.
  const { data, error } = await supabase.from('canonical_songs').select('id').limit(1);
  
  if (error && error.code === '42P01') {
    console.error('Table "canonical_songs" does not exist.');
    console.log('Please run the SQL script in your Supabase SQL editor.');
  } else if (error) {
    console.error('Error checking table:', error);
  } else {
    console.log('Table "canonical_songs" already exists!');
  }
}

setup();
