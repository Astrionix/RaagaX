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
    image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg',
    monthlyListeners: 38400000,
    bio: 'Prominent playback singer known for soulful Hindi & Bengali hits.',
    genres: ['Bollywood', 'Romantic'],
  },
  {
    id: '456323',
    name: 'Pritam',
    image: 'https://c.saavncdn.com/artists/Pritam_002_20200810103947_500x500.jpg',
    monthlyListeners: 29100000,
    bio: 'Award-winning composer and music producer.',
    genres: ['Composer', 'Bollywood'],
  },
  {
    id: '689580',
    name: 'Sid Sriram',
    image: 'https://c.saavncdn.com/artists/Sid_Sriram_003_20230104093817_500x500.jpg',
    monthlyListeners: 18700000,
    bio: 'Indian-American R&B and Carnatic playback singer.',
    genres: ['Telugu', 'Carnatic'],
  },
  {
    id: '456863',
    name: 'Shreya Ghoshal',
    image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20230104093405_500x500.jpg',
    monthlyListeners: 22300000,
    bio: 'Iconic Indian vocalist across multiple languages.',
    genres: ['Melody', 'Multilingual'],
  },
  {
    id: '464627',
    name: 'Anirudh Ravichander',
    image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_002_20230104094030_500x500.jpg',
    monthlyListeners: 25600000,
    bio: 'Sensational composer & singer powering mass blockbusters.',
    genres: ['Mass Beats', 'Tamil'],
  },
  {
    id: '456269',
    name: 'A.R. Rahman',
    image: 'https://c.saavncdn.com/artists/A_R_Rahman_002_20210322074345_500x500.jpg',
    monthlyListeners: 31200000,
    bio: 'Academy Award-winning composer, record producer & songwriter.',
    genres: ['Oscar Winner', 'Legend'],
  },
];
