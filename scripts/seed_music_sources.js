const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const sources = [
    { channel_id: 'UCq-Fj5jknLsUf-MWSy4_brA', handle: 'TSeriesTelugu', label_name: 'T-Series', primary_languages: ['Telugu'] },
    { channel_id: 'UCv33xVn3RABVd0-uB8fD1-w', handle: 'adityamusic', label_name: 'Aditya Music', primary_languages: ['Telugu'] },
    { channel_id: 'UC1K0F3f-OQG6lZ-bC1d-TPA', handle: 'sonymusicsouthofficial', label_name: 'Sony Music South', primary_languages: ['Telugu', 'Tamil', 'Kannada', 'Malayalam'] },
    { channel_id: 'UCT7nKq3fGhtgGf4TtyhL08Q', handle: 'SaregamaTelugu', label_name: 'Saregama', primary_languages: ['Telugu'] },
    { channel_id: 'UCNU4HqM6tV5NfK6BwB-02Yw', handle: 'MangoMusic', label_name: 'Mango Music', primary_languages: ['Telugu'] },
    { channel_id: 'UCVzO_u518OtsFMBzKj0GkQA', handle: 'zeemusicsouth', label_name: 'Zee Music South', primary_languages: ['Telugu', 'Tamil', 'Kannada', 'Malayalam'] },
    { channel_id: 'UCc7rP0eZ8mY_hZg2G1h4Gug', handle: 'madhuraaudio', label_name: 'Madhura Audio', primary_languages: ['Telugu'] },
    { channel_id: 'UCDO-i8D5kO_n43-d9-K5iIg', handle: 'SillyMonksMusic', label_name: 'Silly Monks', primary_languages: ['Telugu'] },
  ];

  console.log('Seeding music_sources table...');
  const { error } = await supabase.from('music_sources').upsert(sources, { onConflict: 'channel_id' });
  
  if (error) {
    console.error('Failed to seed DB:', error);
  } else {
    console.log('Successfully seeded database!');
  }
}

seed();
