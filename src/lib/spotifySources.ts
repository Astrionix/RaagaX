export const BROWSE_5_PLAYLISTS: Record<string, Array<{ id: string; title: string }>> = {
  Telugu: [
    { id: '37i9dQZF1DX5VOFoIqmrOV', title: 'Tollywood Pearls' },
    { id: '37i9dQZF1DWWwrjLPC16W7', title: 'Latest Telugu' },
    { id: '37i9dQZF1DXcrFZ8UTtxv9', title: "All Out 00's Telugu" },
    { id: '37i9dQZF1DX3I9bqAkK5Dr', title: 'Telugu Indie' },
    { id: '37i9dQZF1DWTw6jXuVBprS', title: 'Telangana Folk Beats!' },
  ],
  Tamil: [
    { id: '37i9dQZF1DWTnDuST8OorZ', title: 'All out 00s Tamil' },
    { id: '04wyLWYsskgWjn9827AQj3', title: 'Trending Tamil Songs 2026' },
    { id: '37i9dQZF1DWVeJ1iLJWg8y', title: 'All Out 60s Tamil' },
    { id: '3wVf2PduEomefWHxyzAQy9', title: 'A.R. Rahman Top 100 Tamil' },
    { id: '37i9dQZF1DWVo4cdnikh7Z', title: 'Tamil Golden Hits 100' },
  ],
  Malayalam: [
    { id: '37i9dQZF1DX0pL2mGKNaCP', title: 'All Out 80s Malayalam' },
    { id: '4vgxhCITOiyJf6c4CscEcv', title: 'Retro Malayalam Hits - Carvaan Select' },
    { id: '0WnQPikvoy2Bmxm9aYz57r', title: '2010s Malayalam - Best 100' },
    { id: '3ZbWYBiVeapp2FNOP3xCQT', title: 'Athimanoharam Trending Malayalam Songs' },
    { id: '17I0RT5oDNpbfcygYyJiZI', title: 'Aadu 3 Latest Malayalam Songs' },
  ],
  Hindi: [
    { id: '37i9dQZF1DX5rOEFf3Iycd', title: 'All Out 80s Hindi' },
    { id: '37i9dQZF1DX9kVlnA5Si6s', title: 'All Out 70s Hindi' },
    { id: '37i9dQZF1DWZNJXX2UeBij', title: "All Out 00's Hindi" },
    { id: '6EeFow2EmkVYH8HgsT4wEB', title: 'Most Listened Hindi Songs of July 2026' },
    { id: '5gSVvj8ukLSQlSnClSp1sR', title: 'Best Bollywood Songs of All Time' },
  ],
  English: [
    { id: '0QN2m4k1Mwgv6XO2UoVuNn', title: 'Top 100 Most Viewed English Songs of All Time' },
    { id: '3Fvb75V9A1mS181CXBAt1m', title: 'Top 100 Songs on Spotify 2026' },
    { id: '37i9dQZF1DX13sApGEHdQm', title: '100 Greatest Pop Songs of the Streaming Era' },
    { id: '1NxJn9tmppNrsJBrudFQ7d', title: 'English Top Hits of all Time' },
    { id: '30oqz6VqelMmEzAZ0b1VoO', title: 'Top Hits 2026 TOP 40 Popular Songs' },
  ],
  Kannada: [
    { id: '37i9dQZF1DWZqTcNLmb3sH', title: 'Latest Kannada' },
    { id: '37i9dQZF1DX1ahAlaaz0ZE', title: 'Hot Hits Kannada' },
    { id: '6ppm1rd8zW1FfkWkLOJd80', title: 'Top Hits Kannada 2026' },
    { id: '37i9dQZF1DX9i6vCEoH6jH', title: 'Kannada Party Time' },
    { id: '2RPM7DnMrkGVtyGKluPb2P', title: 'Sonu Nigam Kannada Hits 100' },
  ]
};

export const TRENDING_SOURCES: Record<string, { id: string; title: string }> = {
  Telugu: {
    id: "37i9dQZF1DWTt3gMo0DLxA",
    title: "Trending Now Telugu",
  },
  Tamil: {
    id: "37i9dQZF1DX1i3hvzHpcQV",
    title: "Hot Hits Tamil",
  },
  Malayalam: {
    id: "37i9dQZF1DWTYKFynxp6Fs",
    title: "Trending Now Malayalam",
  },
  Kannada: {
    id: "37i9dQZF1DWZqTcNLmb3sH",
    title: "Latest Kannada",
  },
  Hindi: {
    id: "37i9dQZF1DX0XUfTFmNBRM",
    title: "Top Hits Hindi",
  },
  English: {
    id: "37i9dQZF1DX4JAvHpjipBk",
    title: "New Music Friday",
  },
};

export const NEW_RELEASES_SOURCES: Record<string, { id: string; title: string }> = {
  Telugu: {
    id: "37i9dQZF1DX6XE7HRLM75P",
    title: "Hot Hits Telugu",
  },
  Tamil: {
    id: "7bqFUglbXOoeAPRRNDTnf1",
    title: "New Tamil Releases",
  },
  Kannada: {
    id: "37i9dQZF1DX1ahAlaaz0ZE",
    title: "Hot Hits Kannada",
  },
  Malayalam: {
    id: "37i9dQZF1DX688wU47emR9",
    title: "Hot Hits Malayalam",
  },
  Hindi: {
    id: "1DO7dVkgzMUMwLqIQCLWYR",
    title: "New Hindi Releases",
  },
  English: {
    id: "37i9dQZF1DX0kbJZpiYdZl",
    title: "Hot Hits USA",
  },
};

export const HOT_HITS_SOURCES = NEW_RELEASES_SOURCES;

export const CLASSICS_SOURCES: Record<string, { id: string; title: string }> = {
  Telugu: {
    id: "4dzpSKUB2IlBGkQD5IVLD9",
    title: "Telugu Old Melody Songs",
  },
  Kannada: {
    id: "0iEJUBhOq5bSeu0Bsyu7vs",
    title: "Kannada All Time Hit / Melody",
  },
  Tamil: {
    id: "7ysyJuSXHV3JBkZ0n1B1dg",
    title: "Tamil Old Golden Songs (80s+)",
  },
  Hindi: {
    id: "0BKk3SchfjIinBX6biEQy7",
    title: "Evergreen Old Bollywood Songs",
  },
  Malayalam: {
    id: "321I9FccidF8E0irrX4dYz",
    title: "Malayalam Old Songs - Evergreen",
  },
  English: {
    id: "3z66YlKNJxRava5MreQKKO",
    title: "English Classics Old / Retro 70s–90s",
  },
};

export const NEW_SOURCES: Record<string, {
  primary: string[];
  secondary: string[];
}> = {
  Telugu: {
    primary: [
      "37i9dQZF1DWTt3gMo0DLxA",
      "37i9dQZF1DX6XE7HRLM75P",
      "4dzpSKUB2IlBGkQD5IVLD9"
    ],
    secondary: [
      "7EpmzCQVjm6lz4GlBCNZYP"
    ]
  },
  Kannada: {
    primary: [
      "37i9dQZF1DWZqTcNLmb3sH",
      "37i9dQZF1DX1ahAlaaz0ZE",
      "0iEJUBhOq5bSeu0Bsyu7vs"
    ],
    secondary: [
      "2RPM7DnMrkGVtyGKluPb2P"
    ]
  },
  Tamil: {
    primary: [
      "37i9dQZF1DX1i3hvzHpcQV",
      "7ysyJuSXHV3JBkZ0n1B1dg",
      "3E7NJ4AE8fweSdoOgCQS0w"
    ],
    secondary: [
      "1tvO8pnSjTe1Rxwm78FGnW"
    ]
  },
  Malayalam: {
    primary: [
      "37i9dQZF1DWTYKFynxp6Fs",
      "37i9dQZF1DX688wU47emR9",
      "321I9FccidF8E0irrX4dYz"
    ],
    secondary: []
  },
  Hindi: {
    primary: [
      "37i9dQZF1DX0XUfTFmNBRM",
      "0BKk3SchfjIinBX6biEQy7",
      "6vMOECoVzCMbqU5jPnfgIT"
    ],
    secondary: [
      "6Z3BmVoSFRvMeMkv9XclTb"
    ]
  },
  English: {
    primary: [
      "37i9dQZF1DX4JAvHpjipBk",
      "37i9dQZF1DX0kbJZpiYdZl",
      "3z66YlKNJxRava5MreQKKO"
    ],
    secondary: [
      "1kFo0mfkxvUSe2GZcjzTHL"
    ]
  }
};

export const SOURCES = NEW_SOURCES;

export const CATEGORY_SPOTIFY_SOURCES: Record<string, Record<string, { id: string; title: string }>> = Object.fromEntries(
  Object.entries(BROWSE_5_PLAYLISTS).map(([lang, items]) => [
    lang,
    {
      language: items[0] || { id: '37i9dQZF1DWTt3gMo0DLxA', title: `${lang} Top Hits` },
      new_music: items[1] || { id: '37i9dQZF1DX6XE7HRLM75P', title: `New ${lang} Releases` },
      charts: items[0] || { id: '37i9dQZF1DWTt3gMo0DLxA', title: `${lang} Charts` },
      playlists: items[2] || { id: '37i9dQZF1DX3I9bqAkK5Dr', title: `${lang} Curated Playlists` },
      mood: items[3] || { id: '37i9dQZF1DWTw6jXuVBprS', title: `${lang} Mood & Beats` },
      genres: items[4] || { id: '37i9dQZF1DWWwrjLPC16W7', title: `${lang} Genres & Mixes` }
    }
  ])
);
