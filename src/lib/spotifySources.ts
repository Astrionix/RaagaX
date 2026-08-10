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
    id: "37i9dQZF1DX1i3hvzHpcQV",
    title: "Hot Hits Tamil",
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
    id: "37i9dQZF1DX0XUfTFmNBRM",
    title: "Hot Hits Hindi",
  },
  English: {
    id: "37i9dQZF1DX0kbJZpiYdZl",
    title: "Hot Hits USA",
  },
};

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
      "37i9dQZF1DWTt3gMo0DLxA", // Trending Now Telugu
      "37i9dQZF1DX6XE7HRLM75P", // Hot Hits Telugu
      "4dzpSKUB2IlBGkQD5IVLD9"  // Telugu Old Melody Songs
    ],
    secondary: [
      "7EpmzCQVjm6lz4GlBCNZYP"   // Thaman Top 200 Hits Telugu
    ]
  },

  Kannada: {
    primary: [
      "37i9dQZF1DWZqTcNLmb3sH", // Latest Kannada — Spotify
      "37i9dQZF1DX1ahAlaaz0ZE", // Hot Hits Kannada
      "0iEJUBhOq5bSeu0Bsyu7vs"  // Kannada All Time Hit / Melody
    ],
    secondary: [
      "2RPM7DnMrkGVtyGKluPb2P", // Sonu Nigam Kannada Hits
      "4gEu20D7S53LUJqpma2MvS", // Puneeth Rajkumar Kannada Hits
      "58vfzeU7ZGgmV2SzQ1vLPV"  // Raghu Dixit Kannada Hits
    ]
  },

  Tamil: {
    primary: [
      "37i9dQZF1DX1i3hvzHpcQV", // Hot Hits Tamil — Spotify
      "7ysyJuSXHV3JBkZ0n1B1dg", // Tamil Old Golden Songs (80s+)
      "3E7NJ4AE8fweSdoOgCQS0w"  // Tamil Hits 1990s–2022
    ],
    secondary: [
      "1tvO8pnSjTe1Rxwm78FGnW"  // Tamil hits 1996–2000
    ]
  },

  Malayalam: {
    primary: [
      "37i9dQZF1DWTYKFynxp6Fs", // Trending Now Malayalam
      "37i9dQZF1DX688wU47emR9", // Hot Hits Malayalam
      "321I9FccidF8E0irrX4dYz"  // Malayalam Old Songs - Evergreen
    ],
    secondary: []
  },

  Hindi: {
    primary: [
      "37i9dQZF1DX0XUfTFmNBRM", // Hot Hits Hindi / Top Hits Hindi
      "0BKk3SchfjIinBX6biEQy7", // Evergreen Old Bollywood Songs
      "6vMOECoVzCMbqU5jPnfgIT"  // Hindi Songs 2026
    ],
    secondary: [
      "6Z3BmVoSFRvMeMkv9XclTb", // Top Bollywood Hits 2026
      "6uI26cdAvrmMgTNHrF0g6j", // Hindi mixed moods
      "0lgFD8THSkuGLc7HxdCoog", // Best Hindi Songs
      "6RMAWr6LmvnNeuHZENr1V3"  // Best Hindi Songs 2026
    ]
  },

  English: {
    primary: [
      "37i9dQZF1DX4JAvHpjipBk", // New Music Friday — Spotify
      "37i9dQZF1DX0kbJZpiYdZl", // Hot Hits USA — Spotify
      "3z66YlKNJxRava5MreQKKO"  // English Classics Old / Retro 70s–90s
    ],
    secondary: [
      "1kFo0mfkxvUSe2GZcjzTHL", // Feel-Good Pop Hits 2026
      "0IixkV6ydpdcfsEtHxCPlP", // Viral Hits 2026
      "23Q7biosrwvcqdnJgWEHYZ"  // Viral Hits Worldwide
    ]
  }
};

export const SOURCES = NEW_SOURCES;

export const CATEGORY_SPOTIFY_SOURCES: Record<string, Record<string, { id: string; title: string }>> = Object.fromEntries(
  Object.entries(NEW_SOURCES).map(([lang, data]) => [
    lang,
    {
      language: { id: data.primary[0], title: `${lang} Top Hits` },
      new_music: { id: NEW_RELEASES_SOURCES[lang]?.id || data.primary[1] || data.primary[0], title: NEW_RELEASES_SOURCES[lang]?.title || `New ${lang} Releases` },
      charts: { id: TRENDING_SOURCES[lang]?.id || data.primary[0], title: TRENDING_SOURCES[lang]?.title || `${lang} Charts` },
      playlists: { id: data.primary[2] || data.secondary[0] || data.primary[0], title: `${lang} Curated Playlists` },
      mood: { id: data.secondary[0] || data.primary[0], title: `${lang} Mood & Love` },
      genres: { id: CLASSICS_SOURCES[lang]?.id || data.secondary[1] || data.primary[0], title: CLASSICS_SOURCES[lang]?.title || `${lang} Classics` }
    }
  ])
);
