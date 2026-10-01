import {
  ILyricsProvider,
  LyricsQuery,
  LyricLine,
  LyricsData,
  LyricsSource,
  LyricsSyncType,
  ProviderMeta,
} from "@/types/lyrics";
import { BetterLyricsProvider, BetterLyricsPortatoProvider } from "./providers/better-lyrics";
import { LyricsPlusProvider } from "./providers/lyrics-plus";
import { SimpMusicProvider } from "./providers/simp-music";
import { UnisonProvider } from "./providers/unison";
import { YouTubeMusicLyricsProvider, YouTubeTranscriptProvider } from "./providers/youtube-lyrics";
import { LrcLibProvider } from "./providers/lrclib";
import { KuGouProvider } from "./providers/kugou";
import { MusixmatchProvider } from "./providers/musixmatch";
import { GeniusProvider } from "./providers/genius";

export class LyricsRepository {
  private readonly providers: Map<LyricsSource, ILyricsProvider> = new Map();
  private readonly cache: Map<string, LyricsData> = new Map();
  private readonly MAX_CACHE = 100;

  // The prioritized order for Raaga YouTube-centric catalog
  private readonly defaultPriority: LyricsSource[] = [
    "SIMP_MUSIC",          // Keyed on exact YouTube videoId (zero edit-drift)
    "BETTER_LYRICS",       // Apple Music TTML syllable sync
    "LYRICS_PLUS",         // Syllable sync via YouLy+ mirrors
    "BETTER_LYRICS_PORTATO",// QQ Music karaoke TTML
    "UNISON",              // Community sync
    "YOUTUBE_TRANSCRIPT",  // Official timed captions
    "LRCLIB",              // High-uptime line sync
    "KUGOU",               // International & Hindi/Asian line sync
    "MUSIXMATCH",          // Musixmatch line/word sync
    "YOUTUBE_MUSIC",       // Official YouTube Music tab lyrics
    "GENIUS",              // Web scraper plain text fallback
  ];

  constructor() {
    this.register(new SimpMusicProvider());
    this.register(new BetterLyricsProvider());
    this.register(new BetterLyricsPortatoProvider());
    this.register(new LyricsPlusProvider());
    this.register(new UnisonProvider());
    this.register(new YouTubeTranscriptProvider());
    this.register(new YouTubeMusicLyricsProvider());
    this.register(new LrcLibProvider());
    this.register(new KuGouProvider());
    this.register(new MusixmatchProvider());
    this.register(new GeniusProvider());
  }

  private register(provider: ILyricsProvider) {
    this.providers.set(provider.id, provider);
  }

  public getAvailableProviders(): ProviderMeta[] {
    const list: ProviderMeta[] = [
      {
        id: "AUTO",
        label: "Auto (Best Match)",
        detail: "Automatically races all sources for highest-fidelity syllable & word timing",
        syncType: "syllable-synced",
      },
      ...this.defaultPriority
        .map((id) => this.providers.get(id))
        .filter((p): p is ILyricsProvider => Boolean(p))
        .map((p) => ({
          id: p.id,
          label: p.label,
          detail: p.detail,
          syncType: p.syncType,
        })),
    ];
    return list;
  }

  public async getLyrics(query: LyricsQuery): Promise<LyricsData> {
    const cacheKey = `${query.videoId || ""}_${query.title}_${query.artist}_${query.preferredSource || "auto"}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 1. If user explicitly requested a specific provider (and it's not AUTO), query that one specifically
    if (query.preferredSource && query.preferredSource !== "AUTO" && this.providers.has(query.preferredSource)) {
      const specific = this.providers.get(query.preferredSource)!;
      try {
        const lines = await specific.fetch(query);
        if (lines && lines.length > 0) {
          const res = this.buildResult(specific, lines);
          this.remember(cacheKey, res);
          return res;
        } else {
          // Explicitly chosen provider had no lyrics for this song
          const notFoundRes: LyricsData = {
            synced: false,
            syncType: "plain",
            lines: [],
            plainText: "",
            provider: specific.label,
            providerId: specific.id,
            hasTimestamps: false,
            hasWordSync: false,
            availableProviders: this.getAvailableProviders(),
            notFoundOnProvider: true,
          };
          this.remember(cacheKey, notFoundRes);
          return notFoundRes;
        }
      } catch (err) {
        console.warn(`Preferred lyrics provider ${query.preferredSource} failed:`, err);
        const notFoundRes: LyricsData = {
          synced: false,
          syncType: "plain",
          lines: [],
          plainText: "",
          provider: specific.label,
          providerId: specific.id,
          hasTimestamps: false,
          hasWordSync: false,
          availableProviders: this.getAvailableProviders(),
          notFoundOnProvider: true,
        };
        return notFoundRes;
      }
    }

    // 2. Multi-provider concurrent race in prioritized order
    let bestLineSynced: { provider: ILyricsProvider; lines: LyricLine[] } | null = null;
    let bestPlain: { provider: ILyricsProvider; lines: LyricLine[] } | null = null;

    // Run high-priority providers
    const order = this.defaultPriority.map((id) => this.providers.get(id)).filter(Boolean) as ILyricsProvider[];

    // Batch 1: Fast syllable/word providers & exact videoId match
    const primaryTier = order.slice(0, 5);
    const secondaryTier = order.slice(5);

    const primaryPromises = primaryTier.map(async (provider) => {
      try {
        const lines = await provider.fetch(query);
        return { provider, lines };
      } catch {
        return { provider, lines: null };
      }
    });

    const primaryResults = await Promise.all(primaryPromises);

    for (const res of primaryResults) {
      if (!res.lines || !res.lines.length) continue;

      const hasWordSync = res.lines.some((l) => Boolean(l.words && l.words.length > 0));
      if (hasWordSync) {
        const winner = this.buildResult(res.provider, res.lines);
        this.remember(cacheKey, winner);
        return winner;
      }

      const hasLineSync = res.lines.some((l) => l.startTimeMs > 0);
      if (hasLineSync && !bestLineSynced) {
        bestLineSynced = { provider: res.provider, lines: res.lines };
      } else if (!bestPlain) {
        bestPlain = { provider: res.provider, lines: res.lines };
      }
    }

    // If a line-synced result was found in tier 1, return it
    if (bestLineSynced) {
      const winner = this.buildResult(bestLineSynced.provider, bestLineSynced.lines);
      this.remember(cacheKey, winner);
      return winner;
    }

    // Batch 2: Fallback tier (LRCLIB, KuGou, Musixmatch, YouTube, Genius)
    const secondaryPromises = secondaryTier.map(async (provider) => {
      try {
        const lines = await provider.fetch(query);
        return { provider, lines };
      } catch {
        return { provider, lines: null };
      }
    });

    const secondaryResults = await Promise.all(secondaryPromises);

    for (const res of secondaryResults) {
      if (!res.lines || !res.lines.length) continue;

      const hasWordSync = res.lines.some((l) => Boolean(l.words && l.words.length > 0));
      if (hasWordSync) {
        const winner = this.buildResult(res.provider, res.lines);
        this.remember(cacheKey, winner);
        return winner;
      }

      const hasLineSync = res.lines.some((l) => l.startTimeMs > 0);
      if (hasLineSync && !bestLineSynced) {
        bestLineSynced = { provider: res.provider, lines: res.lines };
      } else if (!bestPlain) {
        bestPlain = { provider: res.provider, lines: res.lines };
      }
    }

    if (bestLineSynced) {
      const winner = this.buildResult(bestLineSynced.provider, bestLineSynced.lines);
      this.remember(cacheKey, winner);
      return winner;
    }

    if (bestPlain) {
      const winner = this.buildResult(bestPlain.provider, bestPlain.lines);
      this.remember(cacheKey, winner);
      return winner;
    }

    // Final Empty Fallback
    const fallback: LyricsData = {
      synced: false,
      syncType: "plain",
      lines: [],
      plainText: "No lyrics found for this track.",
      provider: "None",
      providerId: "LRCLIB",
      hasTimestamps: false,
      hasWordSync: false,
      availableProviders: this.getAvailableProviders(),
    };
    return fallback;
  }

  private buildResult(provider: ILyricsProvider, lines: LyricLine[]): LyricsData {
    const hasWordSync = lines.some((l) => Boolean(l.words && l.words.length > 0));
    const hasTimestamps = lines.some((l) => l.startTimeMs > 0);

    let syncType: LyricsSyncType = "plain";
    if (hasWordSync) {
      syncType = provider.syncType === "syllable-synced" ? "syllable-synced" : "word-synced";
    } else if (hasTimestamps) {
      syncType = "line-synced";
    }

    const plainText = lines
      .map((l) => l.text)
      .filter((t) => t.trim().length > 0)
      .join("\n");

    return {
      synced: hasTimestamps || hasWordSync,
      syncType,
      lines,
      plainText,
      provider: provider.label,
      providerId: provider.id,
      hasTimestamps,
      hasWordSync,
      availableProviders: this.getAvailableProviders(),
    };
  }

  private remember(key: string, data: LyricsData) {
    if (this.cache.size >= this.MAX_CACHE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, data);
  }
}

export const lyricsRepository = new LyricsRepository();
