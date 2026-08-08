import { Song, Artist, Album, Playlist, RadioStation } from '@/types/music';

// Reliable, CORS-enabled public MP3 streams
const AUDIO_STREAMS = [
  'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
  'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=energy-10499.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73373.mp3?filename=pop-beat-110298.mp3',
  'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939ee9306.mp3?filename=calm-acoustic-guitar-124976.mp3',
  'https://cdn.pixabay.com/download/audio/2022/02/07/audio_659a43a08d.mp3?filename=ambient-piano-10781.mp3',
];

export const SAMPLE_SONGS: Song[] = [
  {
    id: 's1',
    title: 'Samajavaragamana',
    artist: 'Sid Sriram',
    artistId: 'a1',
    album: 'Ala Vaikunthapurramuloo',
    albumId: 'al1',
    duration: 215,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[0],
    genre: 'Telugu Melody',
    category: 'latest_telugu',
    releaseYear: 2020,
    plays: 14500000,
    likes: 890000,
    downloads: 450000,
    popularity: 98,
    audioQuality: '24-bit FLAC',
    bitrate: '1411 kbps',
    sampleRate: '96 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Neeli neeli aakasam idhe..." },
      { time: 12, text: "Samajavaragamana ninu choosi aagagalana" },
      { time: 24, text: "Manasu meeda maata aagade neeloni andham choosthu" },
      { time: 38, text: "Kanti reppa paatu lo vethika neeli kadali alalani" },
      { time: 52, text: "Chiru navvula chilaka nuvve naatho unte chaalu" },
      { time: 68, text: "O cheliya na cheliya nee paruvu naaku siriye" },
      { time: 84, text: "Samajavaragamana ninu choosi aagagalana..." }
    ],
    credits: {
      composer: 'Thaman S',
      lyricist: 'Sirivennela Seetharama Sastry',
      singers: ['Sid Sriram'],
      label: 'Aditya Music'
    }
  },
  {
    id: 's2',
    title: 'Ramuloo Ramulaa',
    artist: 'Anurag Kulkarni, Mangli',
    artistId: 'a2',
    album: 'Ala Vaikunthapurramuloo',
    albumId: 'al1',
    duration: 232,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[1],
    genre: 'Telugu Mass',
    category: 'mass',
    releaseYear: 2020,
    plays: 28900000,
    likes: 1420000,
    downloads: 820000,
    popularity: 96,
    audioQuality: 'Dolby Atmos',
    bitrate: '1411 kbps',
    sampleRate: '48 kHz',
    codec: 'E-AC3',
    lyrics: [
      { time: 0, text: "Ramuloo Ramula nannu pamba regadene..." },
      { time: 15, text: "Mande ennapusalo majja majjaa chindhule" },
      { time: 30, text: "Tamaku tamaku tammulu oogi aade gunde thoti" },
      { time: 45, text: "Oora thassadiyya idhi keka mass party!" }
    ],
    credits: {
      composer: 'Thaman S',
      lyricist: 'Kasarla Shyam',
      singers: ['Anurag Kulkarni', 'Mangli'],
      label: 'Aditya Music'
    }
  },
  {
    id: 's3',
    title: 'Oo Antava Mava.. Oo Oo Antava',
    artist: 'Indravathi Chauhan',
    artistId: 'a3',
    album: 'Pushpa: The Rise',
    albumId: 'al2',
    duration: 218,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[2],
    genre: 'Folk Beats',
    category: 'mass',
    releaseYear: 2021,
    plays: 35000000,
    likes: 2100000,
    downloads: 1200000,
    popularity: 99,
    audioQuality: 'Hi-Res Lossless',
    bitrate: '2304 kbps',
    sampleRate: '96 kHz',
    codec: 'ALAC',
    lyrics: [
      { time: 0, text: "Koka koka kadhu meku gaaraala cheerale" },
      { time: 14, text: "Oo antava mava.. oo oo antava mava" },
      { time: 28, text: "Mabbu lanti sneham meedi sooridanti kanti vala" },
      { time: 44, text: "Malle poovu lanti chinna navvu chaale maaku" }
    ],
    credits: {
      composer: 'Devi Sri Prasad (DSP)',
      lyricist: 'Chandrabose',
      singers: ['Indravathi Chauhan'],
      label: 'T-Series Telugu'
    }
  },
  {
    id: 's4',
    title: 'Srivalli',
    artist: 'Sid Sriram',
    artistId: 'a1',
    album: 'Pushpa: The Rise',
    albumId: 'al2',
    duration: 220,
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[3],
    genre: 'Telugu Love',
    category: 'love',
    releaseYear: 2021,
    plays: 42000000,
    likes: 2900000,
    downloads: 1650000,
    popularity: 97,
    audioQuality: '24-bit FLAC',
    bitrate: '1411 kbps',
    sampleRate: '96 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Choope bangaramayeeyye Srivalli..." },
      { time: 16, text: "Nee choopuki maata raaka na gunde thadabade" },
      { time: 32, text: "Kaallaku paala kadali nuvve saageti vaagu" },
      { time: 48, text: "Nee adugu padithe maata maaya adhi tholiprema" }
    ],
    credits: {
      composer: 'Devi Sri Prasad (DSP)',
      lyricist: 'Chandrabose',
      singers: ['Sid Sriram'],
      label: 'T-Series Telugu'
    }
  },
  {
    id: 's5',
    title: 'Priyamathanam (Classic 90s)',
    artist: 'S.P. Balasubrahmanyam, K.S. Chithra',
    artistId: 'a4',
    album: 'Jagadeka Veerudu Athiloka Sundari',
    albumId: 'al3',
    duration: 275,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[4],
    genre: '90s Evergreen',
    category: '90s_telugu',
    releaseYear: 1990,
    plays: 18000000,
    likes: 1200000,
    downloads: 680000,
    popularity: 92,
    audioQuality: 'Spatial Audio',
    bitrate: '1411 kbps',
    sampleRate: '44.1 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Priyamathanam madhuramathanam..." },
      { time: 20, text: "Devatha chese tholi pranam ee prema" },
      { time: 40, text: "Swargaalu dhaate oka chinni muddhuloo" },
      { time: 60, text: "Amrutha varsham prathi gundelo" }
    ],
    credits: {
      composer: 'Ilayaraja',
      lyricist: 'Veturi Sundararama Murthy',
      singers: ['S.P. Balasubrahmanyam', 'K.S. Chithra'],
      label: 'Saregama Telugu'
    }
  },
  {
    id: 's6',
    title: 'Inkem Inkem Inkem Kaavaale',
    artist: 'Sid Sriram',
    artistId: 'a1',
    album: 'Geetha Govindam',
    albumId: 'al4',
    duration: 265,
    coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[0],
    genre: 'Melody',
    category: 'melody',
    releaseYear: 2018,
    plays: 52000000,
    likes: 3400000,
    downloads: 1900000,
    popularity: 99,
    audioQuality: '24-bit FLAC',
    bitrate: '1411 kbps',
    sampleRate: '96 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Inkem inkem inkem kaavaale..." },
      { time: 18, text: "Chaale idhe chaale..." },
      { time: 36, text: "Nee kaali andhe raagaana nenu karigiponaa" },
      { time: 54, text: "Edo maaya chesaave chinni gundeni" }
    ],
    credits: {
      composer: 'Gopi Sundar',
      lyricist: 'Ananta Sriram',
      singers: ['Sid Sriram'],
      label: 'Aditya Music'
    }
  },
  {
    id: 's7',
    title: 'Annamayya Devotional Raaga',
    artist: 'S.P. Balasubrahmanyam',
    artistId: 'a4',
    album: 'Annamayya Divine Hits',
    albumId: 'al5',
    duration: 310,
    coverUrl: 'https://images.unsplash.com/photo-1542382257-80dedb725088?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[1],
    genre: 'Devotional',
    category: 'devotional',
    releaseYear: 1997,
    plays: 9500000,
    likes: 850000,
    downloads: 320000,
    popularity: 90,
    audioQuality: '24-bit FLAC',
    bitrate: '1411 kbps',
    sampleRate: '96 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Nigama nigamantha varnitha charitha..." },
      { time: 25, text: "Govinda Govinda Govinda..." },
      { time: 50, text: "Venkateswara namami srimannarayana" },
      { time: 75, text: "Sarva papa haram devum thirumala vaasudhevum" }
    ],
    credits: {
      composer: 'M. M. Keeravani',
      lyricist: 'Annamacharya',
      singers: ['S.P. Balasubrahmanyam'],
      label: 'Jhankar Music'
    }
  },
  {
    id: 's8',
    title: 'Bullettu Bandi (Folk Sensation)',
    artist: 'Mohana Bhogaraju',
    artistId: 'a5',
    album: 'Folk Beats Collection',
    albumId: 'al6',
    duration: 210,
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[2],
    genre: 'Folk Beats',
    category: 'folk',
    releaseYear: 2021,
    plays: 21000000,
    likes: 1350000,
    downloads: 710000,
    popularity: 93,
    audioQuality: 'Dolby Atmos',
    bitrate: '1411 kbps',
    sampleRate: '48 kHz',
    codec: 'E-AC3',
    lyrics: [
      { time: 0, text: "Nee Bullettu bandi ekki vachestha..." },
      { time: 14, text: "Bangaru maava ninnu choodagane gunde thadi aye" },
      { time: 28, text: "Palletoori pilla naa mass dance keka" }
    ],
    credits: {
      composer: 'SK Baji',
      lyricist: 'Kasarla Shyam',
      singers: ['Mohana Bhogaraju'],
      label: '1k Music'
    }
  },
  {
    id: 's9',
    title: 'Naatu Naatu (RRR)',
    artist: 'Rahul Sipligunj, Kaala Bhairava',
    artistId: 'a6',
    album: 'RRR (Original Soundtrack)',
    albumId: 'al7',
    duration: 215,
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[3],
    genre: 'Telugu Mass / High Energy',
    category: 'mass',
    releaseYear: 2022,
    plays: 85000000,
    likes: 6200000,
    downloads: 4100000,
    popularity: 100,
    audioQuality: '24-bit FLAC',
    bitrate: '2304 kbps',
    sampleRate: '96 kHz',
    codec: 'FLAC',
    lyrics: [
      { time: 0, text: "Polam gattu dhumbulaana podha kattu jolulana..." },
      { time: 15, text: "Naatu Naatu Naatu Naatu Naatu Veera Naatu!" },
      { time: 30, text: "Pachhi mirapa thinnattu pilla maami korikattu" },
      { time: 45, text: "Rekkalu virichina pitta laaga chindhulu veyye!" }
    ],
    credits: {
      composer: 'M. M. Keeravani',
      lyricist: 'Chandrabose',
      singers: ['Rahul Sipligunj', 'Kaala Bhairava'],
      label: 'Lahari Music / T-Series'
    }
  },
  {
    id: 's10',
    title: 'Hukum - Thalaivar Alappara',
    artist: 'Anirudh Ravichander',
    artistId: 'a7',
    album: 'Jailer',
    albumId: 'al8',
    duration: 204,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    audioUrl: AUDIO_STREAMS[4],
    genre: 'Global Trending / Mass',
    category: 'global_trending',
    releaseYear: 2023,
    plays: 68000000,
    likes: 4900000,
    downloads: 2900000,
    popularity: 99,
    audioQuality: 'Hi-Res Lossless',
    bitrate: '1411 kbps',
    sampleRate: '96 kHz',
    codec: 'ALAC',
    lyrics: [
      { time: 0, text: "Hukum... Tiger Ka Hukum!" },
      { time: 14, text: "Alappara thalaivar aattam nadakkum..." },
      { time: 28, text: "Fire in the building, system shaker!" }
    ],
    credits: {
      composer: 'Anirudh Ravichander',
      lyricist: 'Super Subu',
      singers: ['Anirudh Ravichander'],
      label: 'Sun Pictures'
    }
  }
];

export const SAMPLE_ARTISTS: Artist[] = [
  {
    id: 'a1',
    name: 'Sid Sriram',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    bio: 'Sid Sriram is an Indian-American Carnatic musician, playback singer, and music producer. Known for his soulful vocal texture and chart-topping romantic melodies in Telugu, Tamil, and Malayalam cinema.',
    monthlyListeners: 12500000,
    genres: ['Melody', 'Carnatic Fusion', 'Telugu Love'],
    topSongIds: ['s1', 's4', 's6'],
    albumIds: ['al1', 'al2', 'al4']
  },
  {
    id: 'a4',
    name: 'S.P. Balasubrahmanyam',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
    bio: 'Sripathi Panditaradhyula Balasubrahmanyam was a legendary Indian playback singer, composer, and actor who recorded over 40,000 songs in 16 languages, holding the Guinness World Record.',
    monthlyListeners: 18900000,
    genres: ['90s Evergreen', 'Devotional', 'Classic Melody'],
    topSongIds: ['s5', 's7'],
    albumIds: ['al3', 'al5']
  },
  {
    id: 'a7',
    name: 'Anirudh Ravichander',
    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    bannerImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
    bio: 'Anirudh Ravichander is an Indian music composer and singer known for his electrifying mass beats, rock synth hooks, and viral anthems across Indian cinema.',
    monthlyListeners: 24000000,
    genres: ['Electronic Rock', 'Mass', 'EDM Fusion'],
    topSongIds: ['s10'],
    albumIds: ['al8']
  }
];

export const SAMPLE_ALBUMS: Album[] = [
  {
    id: 'al1',
    title: 'Ala Vaikunthapurramuloo',
    artist: 'Thaman S',
    artistId: 'a2',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    releaseYear: 2020,
    songIds: ['s1', 's2'],
    genre: 'Telugu Melody & Mass',
    totalDuration: 447,
    audioQuality: '24-bit FLAC'
  },
  {
    id: 'al2',
    title: 'Pushpa: The Rise',
    artist: 'Devi Sri Prasad',
    artistId: 'a3',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    releaseYear: 2021,
    songIds: ['s3', 's4'],
    genre: 'Folk & Mass',
    totalDuration: 438,
    audioQuality: 'Hi-Res Lossless'
  }
];

export const SAMPLE_PLAYLISTS: Playlist[] = [
  {
    id: 'p1',
    title: 'Telugu Top 50 - RaagaX Signature',
    description: 'The definitive chartbuster playlist for Telugu mass beats, soul melodies, and evergreen hits.',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    songIds: ['s1', 's2', 's3', 's4', 's6', 's9'],
    isSmart: true,
    category: 'top50',
    creator: 'RaagaX Editorial',
    followerCount: 245000
  },
  {
    id: 'p2',
    title: "90's Telugu Nostalgia Gold",
    description: 'Relive the golden era of Ilayaraja, SPB, Veturi, and Keeravani masterpieces.',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    songIds: ['s5', 's7'],
    isSmart: false,
    category: '90s_telugu',
    creator: 'RaagaX Classics',
    followerCount: 182000
  },
  {
    id: 'p3',
    title: 'Telugu Workout & High Mass Beats',
    description: 'Pump up your heart rate with high energy Naatu Naatu and Ramuloo Ramulaa drums.',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    songIds: ['s2', 's3', 's9', 's10'],
    isSmart: true,
    category: 'workout',
    creator: 'RaagaX AI DJ',
    followerCount: 310000
  },
  {
    id: 'p4',
    title: 'Night Drive Melodies',
    description: 'Calm ambient synths and acoustic guitar solos for late night highway drives.',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    songIds: ['s1', 's4', 's6'],
    isSmart: true,
    category: 'night_drive',
    creator: 'RaagaX Editorial',
    followerCount: 154000
  }
];

export const SAMPLE_RADIO_STATIONS: RadioStation[] = [
  {
    id: 'r1',
    name: 'RaagaX Telugu Melodies 24/7',
    frequency: '92.7 FM',
    genre: 'Telugu Melody & Soft Acoustic',
    coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&auto=format&fit=crop&q=80',
    streamUrl: AUDIO_STREAMS[0],
    currentTrack: 'Samajavaragamana - Sid Sriram',
    listeners: 45200,
    country: 'India',
    audioQuality: '24-bit FLAC'
  },
  {
    id: 'r2',
    name: 'Telugu Mass Party FM',
    frequency: '98.3 FM',
    genre: 'High Energy Dance & Mass',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    streamUrl: AUDIO_STREAMS[1],
    currentTrack: 'Naatu Naatu - Rahul Sipligunj',
    listeners: 89100,
    country: 'India',
    audioQuality: 'Dolby Atmos'
  },
  {
    id: 'r3',
    name: 'Devotional & Spiritual Waves',
    frequency: '104.0 FM',
    genre: 'Annamacharya Kirthanalu & Stotrams',
    coverUrl: 'https://images.unsplash.com/photo-1542382257-80dedb725088?w=600&auto=format&fit=crop&q=80',
    streamUrl: AUDIO_STREAMS[2],
    currentTrack: 'Nigama Nigamantha - MS Subbulakshmi',
    listeners: 23400,
    country: 'India',
    audioQuality: 'Lossless'
  }
];
