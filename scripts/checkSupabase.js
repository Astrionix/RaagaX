const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('charts').select('*');
  console.log('Error:', error);
  if (data) {
    const newReleases = data.filter(d => d.section_name === 'new_releases');
    console.log('Total charts rows:', data.length);
    console.log('New Releases rows:', newReleases.length);
    if (newReleases.length > 0) {
      console.log('First new release:', newReleases[0]);
    }
  }
}
check();
