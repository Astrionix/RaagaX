export interface PopularArtist {
  id: string;
  name: string;
  image: string;
  monthlyListeners: number;
  bio: string;
  genres: string[];
}

export const POPULAR_ARTISTS: PopularArtist[] = [
  {
    id: '459320',
    name: 'Arijit Singh',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 38400000,
    bio: 'Prominent playback singer known for soulful Hindi & Bengali hits.',
    genres: ['Bollywood', 'Romantic'],
  },
  {
    id: '456323',
    name: 'Pritam',
    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 29100000,
    bio: 'Award-winning composer and music producer.',
    genres: ['Composer', 'Bollywood'],
  },
  {
    id: '689580',
    name: 'Sid Sriram',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 18700000,
    bio: 'Indian-American R&B and Carnatic playback singer.',
    genres: ['Telugu', 'Carnatic'],
  },
  {
    id: '456863',
    name: 'Shreya Ghoshal',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 22300000,
    bio: 'Iconic Indian vocalist across multiple languages.',
    genres: ['Melody', 'Multilingual'],
  },
  {
    id: '464627',
    name: 'Anirudh Ravichander',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 25600000,
    bio: 'Sensational composer & singer powering mass blockbusters.',
    genres: ['Mass Beats', 'Tamil'],
  },
  {
    id: '456269',
    name: 'A.R. Rahman',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    monthlyListeners: 31200000,
    bio: 'Academy Award-winning composer, record producer & songwriter.',
    genres: ['Oscar Winner', 'Legend'],
  },
];
