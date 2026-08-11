const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://qbqnlmfdmfayeztagvkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicW5sbWZkbWZheWV6dGFndmtqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjIwMDM0OSwiZXhwIjoyMTAxNzc2MzQ5fQ.CAob_r1DDe1YJHzPCTwz49WyxK9Yml7T3DYDeNGZZSY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: cols, error: e2 } = await supabase.from('playback_sessions').select('*').limit(1);
  if (cols) {
    if (cols.length > 0) {
      console.log(Object.keys(cols[0]));
    } else {
      console.log("No rows. Trying insert without new columns...");
      const { data: insert, error: ie } = await supabase.from('playback_sessions').upsert({
        session_id: 'test_schema_123',
      }, { onConflict: 'session_id' }).select();
      if (insert && insert.length > 0) {
        console.log(Object.keys(insert[0]));
      } else {
        console.log("Insert failed", ie);
      }
    }
  }
}
test();
