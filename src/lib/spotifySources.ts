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

export const NEW_SOURCES: Record<string, {
  primary: string[];
  secondary: string[];
}> = {
  Telugu: {
    primary: [
      "37i9dQZF1DWTt3gMo0DLxA", // Trending Now Telugu
      "6w4NVkOj7vHg8FUXyOF1f9", // Trending Telugu Songs 2026
      "0A6w9xDIYGrYgXtXEcUmM0"  // Top Telugu Hits 2026
    ],
    secondary: [
      "7EpmzCQVjm6lz4GlBCNZYP"   // Thaman Top 200 Hits Telugu
    ]
  },

  Kannada: {
    primary: [
      "37i9dQZF1DWZqTcNLmb3sH", // Latest Kannada — Spotify
      "6ppm1rd8zW1FfkWkLOJd80", // Top Hits Kannada 2026
      "37i9dQZF1DX9i6vCEoH6jH"  // Kannada Party Time — Spotify
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
      "0cJFpwIlxFm3NsKboxbQ6a", // Tamil Hits 2000–2025
      "3E7NJ4AE8fweSdoOgCQS0w"  // Tamil Hits 1990s–2022
    ],
    secondary: [
      "1tvO8pnSjTe1Rxwm78FGnW"  // Tamil hits 1996–2000
    ]
  },

  Malayalam: {
    primary: [
      "37i9dQZF1DWTYKFynxp6Fs", // Hot Hits Malayalam — Spotify
      "37i9dQZF1DXaDDXaHNhJDD", // Mollywood Gold — Spotify
      "5IqEQiJzYvJmkYirT8NqRx"  // 2026 Malayalam Top Hits
    ],
    secondary: []
  },

  Hindi: {
    primary: [
      "37i9dQZF1DX0XUfTFmNBRM", // Top Hits Hindi
      "7hRdEVx3T8RF8s4QNNSORU", // Top Hindi Songs 2026
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
      "4Ogw0Av7Zlpedzey04qScS"  // Top Hits English
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
      new_music: { id: data.primary[1] || data.primary[0], title: `New ${lang} Releases` },
      charts: { id: TRENDING_SOURCES[lang]?.id || data.primary[0], title: TRENDING_SOURCES[lang]?.title || `${lang} Charts` },
      playlists: { id: data.primary[2] || data.secondary[0] || data.primary[0], title: `${lang} Curated Playlists` },
      mood: { id: data.secondary[0] || data.primary[0], title: `${lang} Mood & Love` },
      genres: { id: data.secondary[1] || data.secondary[0] || data.primary[0], title: `${lang} Genres & Mixes` }
    }
  ])
);
