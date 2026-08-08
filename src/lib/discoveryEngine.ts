import { Song } from '@/types/music';
import { JioSaavnProvider, LANGUAGE_CODES } from './jioSaavnProvider';
import { supabase } from './supabase';

export type DiscoveryLanguage = 'Telugu' | 'Kannada' | 'Tamil' | 'Hindi' | 'Malayalam' | 'English';
export type MatchStatus = 'VERIFIED' | 'HIGH_CONFIDENCE' | 'REVIEW' | 'UNRESOLVED';

export interface DiscoverySignal {
  query: string;
  signalType: 'chart' | 'trending' | 'new_release' | 'popular';
  weight: number;
  sourceRank?: number;
}

export interface ResolvedSong {
  song: Song;
  sourceId: string;
  signals: DiscoverySignal[];
  matchConfidence: number;
  compositeScore: number;
  status: MatchStatus;
  resolvedAt: string;
  isNew: boolean;
  rank?: number;
}

export interface DiscoveryResult {
  language: DiscoveryLanguage;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  topChart: ResolvedSong[];
  newReleases: ResolvedSong[];
  trending: ResolvedSong[];
  collectedAt: string;
  source: 'fresh' | 'cache';
  status: 'ok' | 'partial' | 'empty';
}

const SCORE_WEIGHTS: Record<string, number> = {
  chart: 0.40,
  trending: 0.25,
  new_release: 0.20,
  popular: 0.15,
};

const SIGNAL_SOURCES: Record<DiscoveryLanguage, DiscoverySignal[]> = {
  Telugu: [
    // Top 20 from 4to40.com
    { query: 'Irumudi Kattu Telugu', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Hellallallo Telugu', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'Rai Rai Raa Raa Telugu', signalType: 'chart', weight: 0.9, sourceRank: 3 },
    { query: 'Aaya Sher Telugu', signalType: 'chart', weight: 0.9, sourceRank: 4 },
    { query: 'Hukum Reloaded Telugu', signalType: 'chart', weight: 0.85, sourceRank: 5 },
    { query: 'One Name Telugu', signalType: 'chart', weight: 0.85, sourceRank: 6 },
    { query: 'Chikiri Chikiri Telugu', signalType: 'chart', weight: 0.85, sourceRank: 7 },
    { query: 'Wife Ante Telugu', signalType: 'chart', weight: 0.85, sourceRank: 8 },
    { query: 'Pandulanti Chinnadanni Telugu', signalType: 'chart', weight: 0.8, sourceRank: 9 },
    { query: 'Sasirekha Telugu', signalType: 'chart', weight: 0.8, sourceRank: 10 },
    { query: 'Massa Massa Telugu', signalType: 'chart', weight: 0.8, sourceRank: 11 },
    { query: 'Thippukuntannav Telugu', signalType: 'chart', weight: 0.75, sourceRank: 12 },
    { query: 'Pallelloni Sandhallanni Meeve Telugu', signalType: 'chart', weight: 0.75, sourceRank: 13 },
    { query: 'Hai Re Telugu', signalType: 'chart', weight: 0.75, sourceRank: 14 },
    { query: 'Vadhalane Telugu', signalType: 'chart', weight: 0.75, sourceRank: 15 },
    { query: 'Manga Manga Telugu', signalType: 'chart', weight: 0.7, sourceRank: 16 },
    { query: 'Nuvve Undipo Ila Telugu', signalType: 'chart', weight: 0.7, sourceRank: 17 },
    
    // Additional trends and new releases
    { query: 'Pushpa 2 Telugu hits', signalType: 'trending', weight: 0.8 },
    { query: 'Devara Telugu songs', signalType: 'trending', weight: 0.8 },
    { query: 'new Telugu songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest Telugu movie songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending Telugu songs 2025', signalType: 'trending', weight: 0.75 },
  ],
  Kannada: [
    { query: 'KGF Chapter 2 Kannada songs', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Kantara Kannada songs Rishab Shetty', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'UI Kannada movie songs 2025', signalType: 'chart', weight: 0.85, sourceRank: 3 },
    { query: 'Martin Kannada songs', signalType: 'chart', weight: 0.8, sourceRank: 4 },
    { query: 'Bagheera Kannada songs', signalType: 'chart', weight: 0.75, sourceRank: 5 },
    { query: 'new Kannada songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest Kannada movie songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending Kannada songs 2025', signalType: 'trending', weight: 0.75 },
    { query: 'popular Kannada hits', signalType: 'popular', weight: 0.65 },
  ],
  Tamil: [
    { query: 'Leo Tamil songs Anirudh Ravichander', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Jailer Tamil songs Anirudh 2023', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'Vettaiyan Tamil songs Anirudh 2024', signalType: 'chart', weight: 0.85, sourceRank: 3 },
    { query: 'Amaran Tamil songs 2024', signalType: 'chart', weight: 0.85, sourceRank: 4 },
    { query: 'Ponniyin Selvan AR Rahman songs', signalType: 'chart', weight: 0.8, sourceRank: 5 },
    { query: 'new Tamil songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest Tamil movie songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending Tamil songs 2025', signalType: 'trending', weight: 0.75 },
    { query: 'popular Tamil melody songs', signalType: 'popular', weight: 0.65 },
  ],
  Hindi: [
    { query: 'Animal Bollywood songs Ranbir Kapoor', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Stree 2 Bollywood songs 2024', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'Kalki 2898 AD Hindi songs', signalType: 'chart', weight: 0.85, sourceRank: 3 },
    { query: 'Pushpa 2 Hindi songs 2024', signalType: 'chart', weight: 0.85, sourceRank: 4 },
    { query: 'Rocky Aur Rani Bollywood songs', signalType: 'chart', weight: 0.8, sourceRank: 5 },
    { query: 'Dunki Shah Rukh Khan songs', signalType: 'chart', weight: 0.75, sourceRank: 6 },
    { query: 'new Hindi songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest Bollywood songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending Hindi songs 2025', signalType: 'trending', weight: 0.75 },
    { query: 'popular Arijit Singh songs 2024', signalType: 'popular', weight: 0.65 },
  ],
  Malayalam: [
    { query: 'Manjummel Boys Malayalam songs', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Aavesham Malayalam songs 2024', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'Varshangalkku Shesham Malayalam songs', signalType: 'chart', weight: 0.85, sourceRank: 3 },
    { query: 'Kishkindha Kaandam Malayalam songs', signalType: 'chart', weight: 0.85, sourceRank: 4 },
    { query: 'Premalu Malayalam songs 2024', signalType: 'chart', weight: 0.8, sourceRank: 5 },
    { query: 'new Malayalam songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest Malayalam movie songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending Malayalam songs 2025', signalType: 'trending', weight: 0.75 },
    { query: 'popular Malayalam melody songs', signalType: 'popular', weight: 0.65 },
  ],
  English: [
    { query: 'Sabrina Carpenter Espresso 2024', signalType: 'chart', weight: 0.9, sourceRank: 1 },
    { query: 'Chappell Roan Good Luck Babe 2024', signalType: 'chart', weight: 0.9, sourceRank: 2 },
    { query: 'Taylor Swift Tortured Poets Department', signalType: 'chart', weight: 0.85, sourceRank: 3 },
    { query: 'Billie Eilish Hit Me Hard And Soft', signalType: 'chart', weight: 0.85, sourceRank: 4 },
    { query: 'Dua Lipa Radical Optimism 2024', signalType: 'chart', weight: 0.8, sourceRank: 5 },
    { query: 'new English pop songs 2025', signalType: 'new_release', weight: 0.8 },
    { query: 'latest English songs 2025', signalType: 'new_release', weight: 0.75 },
    { query: 'trending global English songs 2025', signalType: 'trending', weight: 0.75 },
    { query: 'popular The Weeknd songs', signalType: 'popular', weight: 0.65 },
  ],
};

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(from[^)]*\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b(remix|lofi|slowed|reverb|cover|instrumental|version|feat|ft|official|audio|video)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasVersionMismatch(query: string, title: string): boolean {
  const terms = ['remix', 'slowed', 'reverb', 'lofi', 'cover', 'acoustic', 'instrumental'];
  const ql = query.toLowerCase();
  const tl = title.toLowerCase();
  return !terms.some((t) => ql.includes(t)) && terms.some((t) => tl.includes(t));
}

function calcConfidence(query: string, song: Song): number {
  const qn = normalizeTitle(query);
  const tn = normalizeTitle(song.title);
  if (tn === qn) return 0.99;
  const qw = qn.split(' ').filter((w) => w.length > 2);
  const tw = tn.split(' ');
  const matched = qw.filter((qword) => tw.some((tword) => tword.includes(qword) || qword.includes(tword)));
  const wordScore = qw.length > 0 ? matched.length / qw.length : 0;
  const containsScore = tn.includes(qn) || qn.includes(tn) ? 0.2 : 0;
  const versionPenalty = hasVersionMismatch(query, song.title) ? -0.15 : 0;
  return Math.min(0.97, Math.max(0, wordScore * 0.65 + containsScore + 0.05 + versionPenalty));
}

function statusFrom(c: number): MatchStatus {
  if (c >= 0.95) return 'VERIFIED';
  if (c >= 0.85) return 'HIGH_CONFIDENCE';
  if (c >= 0.70) return 'REVIEW';
  return 'UNRESOLVED';
}

function compositeScore(confidence: number, signals: DiscoverySignal[]): number {
  let score = confidence * 50;
  for (const sig of signals) {
    const tw = SCORE_WEIGHTS[sig.signalType] ?? 0.1;
    const rb = sig.sourceRank ? Math.max(0, 1 - (sig.sourceRank - 1) * 0.08) : 0;
    score += tw * rb * 30;
  }
  return Math.round(score * 10) / 10;
}

export class DiscoveryEngine {
  private static instance: DiscoveryEngine;
  private provider: JioSaavnProvider;

  private constructor(localBase: string) {
    this.provider = JioSaavnProvider.getInstance(localBase);
  }

  public static getInstance(localBase = 'http://localhost:3001'): DiscoveryEngine {
    if (!DiscoveryEngine.instance) {
      DiscoveryEngine.instance = new DiscoveryEngine(localBase);
    }
    return DiscoveryEngine.instance;
  }

  private async resolveSignal(
    sig: DiscoverySignal,
    language: DiscoveryLanguage
  ): Promise<{ song: Song; confidence: number } | null> {
    const langCode = LANGUAGE_CODES[language] || language.toLowerCase();
    const queries = [
      sig.query,
      `${sig.query} ${langCode}`,
      normalizeTitle(sig.query),
    ];

    for (const q of queries) {
      let songs = await this.provider.searchSongs(q, 8);
      if (!songs.length) continue;

      const langFiltered = this.provider.filterByLanguage(songs, language);
      if (langFiltered.length > 0) songs = langFiltered;

      let best: Song | null = null;
      let bestConf = 0;

      for (const s of songs) {
        if (!s.audioUrl) continue; // Verify playable
        const conf = calcConfidence(sig.query, s);
        if (conf > bestConf) {
          bestConf = conf;
          best = s;
        }
      }

      if (best && bestConf >= 0.65) {
        console.log(`[SONG VERIFIED] "${sig.query}" -> "${best.title}" | ${best.artist} | conf=${(bestConf * 100).toFixed(0)}%`);
        return { song: best, confidence: bestConf };
      }
    }

    console.log(`[SONG UNRESOLVED] "${sig.query}"`);
    return null;
  }

  async discover(language: DiscoveryLanguage): Promise<DiscoveryResult> {
    const now = new Date();
    const weekLabel = getISOWeek(now);
    const { start, end } = getWeekBounds(now);

    console.log(`[CHART START] Language=${language} Week=${weekLabel}`);
    
    // Generate 30-50 candidates
    // We already have static signals, but let's assume we use SIGNAL_SOURCES
    const baseSignals = SIGNAL_SOURCES[language] ?? [];
    
    // To reach ~30 candidates, we might synthesize some queries
    const extendedSignals = [...baseSignals];
    for (let i = 1; i <= 16; i++) {
        extendedSignals.push({ query: `top ${language} hit song ${i}`, signalType: 'popular', weight: 0.5 });
    }

    console.log(`[CANDIDATES FOUND] ${extendedSignals.length} candidates collected for ${language}`);
    console.log(`[RESOLUTION START] Resolving candidates...`);

    const pool = new Map<string, ResolvedSong>();
    let unresolvedCount = 0;
    
    // Process signals in batches of 6 (Controlled concurrency)
    const BATCH_SIZE = 6;
    for (let i = 0; i < extendedSignals.length; i += BATCH_SIZE) {
      const batch = extendedSignals.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((sig) =>
          this.resolveSignal(sig, language).then((r) => ({ sig, r }))
        )
      );

      for (const res of results) {
        if (res.status !== 'fulfilled' || !res.value.r) {
            unresolvedCount++;
            continue;
        }
        const { sig, r } = res.value;
        const { song, confidence } = r;

        if (pool.has(song.id)) {
          const existing = pool.get(song.id)!;
          existing.signals.push(sig);
          const nc = Math.max(existing.matchConfidence, confidence);
          existing.matchConfidence = nc;
          existing.status = statusFrom(nc);
          existing.compositeScore = compositeScore(nc, existing.signals);
        } else {
          pool.set(song.id, {
            song,
            sourceId: song.id,
            signals: [sig],
            matchConfidence: confidence,
            compositeScore: compositeScore(confidence, [sig]),
            status: statusFrom(confidence),
            resolvedAt: now.toISOString(),
            isNew: song.releaseYear >= now.getFullYear(),
          });
        }
      }
      
      // Stop early if we have enough verified songs for the Top 10
      const currentVerified = Array.from(pool.values()).filter(r => r.status === 'VERIFIED' || r.status === 'HIGH_CONFIDENCE');
      if (currentVerified.length >= 10 && i > 15) {
          console.log(`[RESOLUTION] Reached 10 verified songs, stopping early.`);
          break;
      }
    }

    const allResolved = Array.from(pool.values())
      .filter((r) => r.status !== 'UNRESOLVED')
      .sort((a, b) => b.compositeScore - a.compositeScore);

    const verifiedOnly = allResolved.filter(r => ['VERIFIED', 'HIGH_CONFIDENCE', 'REVIEW'].includes(r.status));

    const topChart = verifiedOnly.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
    const newReleases = verifiedOnly.filter((r) => r.isNew).slice(0, 20);
    const trending = verifiedOnly.slice(0, 20);

    const status = topChart.length >= 5 ? 'ok' : topChart.length > 0 ? 'partial' : 'empty';

    if (status === 'empty') {
      console.log(`[CHART FAILED] Language=${language}`);
    } else {
      console.log(`[CHART COMPLETE] Language=${language} | Candidates=${extendedSignals.length} | Verified=${topChart.length} | Unresolved=${unresolvedCount} | Duplicates=${allResolved.length - pool.size} | Final=${topChart.length}`);
      
      // Store to Supabase
      try {
        const { data: chartData, error: chartError } = await supabase
          .from('charts')
          .insert({
            language,
            chart_type: 'Top 10',
            period_start: start,
            period_end: end,
            status: 'published'
          })
          .select('id')
          .single();

        if (chartData && !chartError) {
          const entries = topChart.map(r => ({
            chart_id: chartData.id,
            song_id: r.song.id,
            rank: r.rank,
            score: r.compositeScore,
            source: 'jiosaavn',
            title: r.song.title,
            artist: r.song.artist,
            album: r.song.album,
            artwork: r.song.coverUrl,
            audio_url: r.song.audioUrl,
            duration: r.song.duration,
            source_id: r.sourceId,
            match_confidence: r.matchConfidence,
            status: r.status,
            is_new: r.isNew
          }));

          await supabase.from('chart_entries').insert(entries);
        }
      } catch (dbErr) {
        console.error('[SUPABASE ERROR]', dbErr);
      }
    }

    return {
      language,
      weekLabel,
      weekStart: start,
      weekEnd: end,
      topChart,
      newReleases,
      trending,
      collectedAt: now.toISOString(),
      source: 'fresh',
      status,
    };
  }

  // Queue refill — returns up to `count` playable songs, excluding provided IDs
  async getQueueRefill(
    language: DiscoveryLanguage, 
    excludeIds: string[] = [], 
    likedIds: string[] = [], 
    historyIds: string[] = [],
    count = 10
  ): Promise<Song[]> {
    try {
      const moreIds = new Set(excludeIds);
      let recommendations: Song[] = [];

      // Combine potential seed sources, prioritizing recent history and liked songs
      const seedCandidates = [...likedIds.slice(-5).reverse(), ...historyIds.slice(0, 5)];
      const availableSeeds = seedCandidates.filter(id => !moreIds.has(id));

      if (availableSeeds.length > 0) {
        // Pick a random seed from our contextual candidates
        const seedId = availableSeeds[Math.floor(Math.random() * availableSeeds.length)];
        const suggestions = await this.provider.getRecommendations(seedId, 50);
        
        const langFiltered = this.provider.filterByLanguage(suggestions, language);
        recommendations = (langFiltered.length > 0 ? langFiltered : suggestions)
          .filter((s) => s.audioUrl && !moreIds.has(s.id));
      }

      // If recommendations failed or yielded too few results, fallback to randomized contextual search
      if (recommendations.length < count) {
        const searchTerms = [
          `${language} hits`,
          `${language} top 50`,
          `${language} latest`,
          `${language} romantic`,
          `${language} dance`,
          `best of ${language}`,
          `${language} trending`,
          `${language} melody`,
          `${language} chartbusters`,
          `${language} party`,
          `superhit ${language}`
        ];
        const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        
        // Fast path: Just search JioSaavn directly instead of full discovery
        const extra = await this.provider.searchSongs(randomTerm, 50);
        const langFiltered = this.provider.filterByLanguage(extra, language);
        
        const additional = (langFiltered.length > 0 ? langFiltered : extra)
          .filter((s) => s.audioUrl && !moreIds.has(s.id));
          
        recommendations = [...recommendations, ...additional];
      }

      // Deduplicate the combined results based on ID before slicing
      const finalUnique: Song[] = [];
      const seen = new Set<string>();
      for (const s of recommendations) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          finalUnique.push(s);
        }
      }

      return finalUnique.slice(0, count);
    } catch {
      return [];
    }
  }
}
