/**
 * RecapEngine — Recurring Music Recap Engine for RaagaX
 *
 * Supports:
 * 1. Weekly Recap (Generated every Monday for previous Mon-Sun)
 * 2. Monthly Recap (Generated on 1st+ of month for previous completed month)
 * 3. Quarterly Recap (Generated after Q1, Q2, Q3, Q4 complete)
 * 4. Half-Year Recap (First Half: Jan-Jun, Second Half: Jul-Dec)
 * 5. Yearly Wrapped (Generated after calendar year completes)
 *
 * Features:
 * - Local timezone bounds
 * - Non-blocking Home loading via cached snapshots
 * - Duplicate prevention (deterministic IDs: weekly:2026-W33, monthly:2026-07, etc.)
 * - Priority banner ordering (Yearly > Half-Year > Quarterly > Monthly > Weekly)
 * - Privacy-respecting (checks tracking toggle)
 * - Zero artificial stats / empty state when insufficient data
 */

import { Song } from '@/types/music';
import { 
  ListeningAnalyticsEngine, 
  RankedSongItem, 
  RankedArtistItem, 
  RankedAlbumItem, 
  LanguageShare,
  ListeningHabitsStats
} from '@/lib/analytics/ListeningAnalyticsEngine';
import { WrappedPersona } from '@/lib/analytics/WrappedGenerator';

export type RecapType = 'weekly' | 'monthly' | 'quarterly' | 'halfyear' | 'yearly';

export interface RecapPeriodInfo {
  id: string;
  type: RecapType;
  title: string;
  bannerTitle: string;
  periodLabel: string;
  startTime: number;
  endTime: number;
}

export interface RecapMetadata {
  id: string;
  type: RecapType;
  title: string;
  bannerTitle: string;
  periodLabel: string;
  generatedAt: number;
  hasData: boolean;
  isRead: boolean;
  totalListeningDisplay: string;
  totalSongsPlayed: number;
  topSongTitle?: string;
  topArtistName?: string;
  coverUrl?: string;
}

export interface MusicRecapData {
  id: string;
  type: RecapType;
  title: string;
  bannerTitle: string;
  periodLabel: string;
  startTime: number;
  endTime: number;
  generatedAt: number;
  hasData: boolean;
  isRead: boolean;
  totalListeningTimeSec: number;
  totalListeningDisplay: string;
  totalSongsPlayed: number;
  topSong: RankedSongItem | null;
  topSongs: RankedSongItem[];
  topArtist: RankedArtistItem | null;
  topArtists: RankedArtistItem[];
  topAlbum: RankedAlbumItem | null;
  topAlbums: RankedAlbumItem[];
  topGenre: string;
  topLanguage: string;
  languageShares: LanguageShare[];
  mostReplayedSong: RankedSongItem | null;
  newArtistsDiscovered: number;
  persona: WrappedPersona;
  habits: ListeningHabitsStats;
}

const STORAGE_INDEX_KEY = 'raagax_recap_index_v1';
const STORAGE_SNAPSHOT_PREFIX = 'raagax_recap_snap_';
const STORAGE_DISMISSED_KEY = 'raagax_recap_dismissed_v1';

export class RecapEngine {
  private static instance: RecapEngine;

  private constructor() {}

  public static getInstance(): RecapEngine {
    if (!RecapEngine.instance) {
      RecapEngine.instance = new RecapEngine();
    }
    return RecapEngine.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. DATE BOUNDS & PERIOD DEFINITIONS (User Local Timezone)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Calculates ISO Week Number in local timezone
   */
  public getWeekNumber(d: Date): { year: number; week: number } {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return { year: target.getFullYear(), week };
  }

  /**
   * Weekly Recap: Previous completed Monday 00:00:00 -> Sunday 23:59:59
   */
  public getCompletedWeeklyPeriod(now: Date = new Date()): RecapPeriodInfo {
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Offset to previous Sunday
    const daysSinceSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    
    const endOfPrevWeek = new Date(now);
    endOfPrevWeek.setDate(now.getDate() - daysSinceSunday);
    endOfPrevWeek.setHours(23, 59, 59, 999);

    const startOfPrevWeek = new Date(endOfPrevWeek);
    startOfPrevWeek.setDate(endOfPrevWeek.getDate() - 6);
    startOfPrevWeek.setHours(0, 0, 0, 0);

    const { year, week } = this.getWeekNumber(startOfPrevWeek);
    const weekStr = week < 10 ? `0${week}` : `${week}`;
    const id = `weekly:${year}-W${weekStr}`;

    const startMonth = startOfPrevWeek.toLocaleString('en-US', { month: 'short' });
    const endMonth = endOfPrevWeek.toLocaleString('en-US', { month: 'short' });
    const periodLabel = startMonth === endMonth
      ? `${startMonth} ${startOfPrevWeek.getDate()} – ${endOfPrevWeek.getDate()}, ${year}`
      : `${startMonth} ${startOfPrevWeek.getDate()} – ${endMonth} ${endOfPrevWeek.getDate()}, ${year}`;

    return {
      id,
      type: 'weekly',
      title: 'Your Week in Music',
      bannerTitle: 'YOUR WEEK IN MUSIC',
      periodLabel,
      startTime: startOfPrevWeek.getTime(),
      endTime: endOfPrevWeek.getTime(),
    };
  }

  /**
   * Monthly Recap: Previous completed calendar month (1st 00:00:00 -> last day 23:59:59)
   */
  public getCompletedMonthlyPeriod(now: Date = new Date()): RecapPeriodInfo {
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;

    const startOfMonth = new Date(year, prevMonthIdx, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, prevMonthIdx + 1, 0, 23, 59, 59, 999);

    const monthNum = prevMonthIdx + 1;
    const monthStr = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    const id = `monthly:${year}-${monthStr}`;

    const monthName = startOfMonth.toLocaleString('en-US', { month: 'long' });
    const periodLabel = `${monthName} ${year}`;

    return {
      id,
      type: 'monthly',
      title: 'Your Month in Music',
      bannerTitle: 'YOUR MONTH IN MUSIC',
      periodLabel,
      startTime: startOfMonth.getTime(),
      endTime: endOfMonth.getTime(),
    };
  }

  /**
   * Quarterly Recap: Previous completed quarter
   * Q1: Jan-Mar (Avail Apr 1+)
   * Q2: Apr-Jun (Avail Jul 1+)
   * Q3: Jul-Sep (Avail Oct 1+)
   * Q4: Oct-Dec (Avail Jan 1+)
   */
  public getCompletedQuarterlyPeriod(now: Date = new Date()): RecapPeriodInfo {
    const currentMonth = now.getMonth(); // 0-11
    let qYear = now.getFullYear();
    let qNum = 1;
    let startMonth = 0;
    let endMonth = 2;

    if (currentMonth >= 0 && currentMonth <= 2) {
      // In Q1 -> last completed was Q4 of prev year
      qYear = now.getFullYear() - 1;
      qNum = 4;
      startMonth = 9;
      endMonth = 11;
    } else if (currentMonth >= 3 && currentMonth <= 5) {
      // In Q2 -> last completed was Q1
      qNum = 1;
      startMonth = 0;
      endMonth = 2;
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      // In Q3 -> last completed was Q2
      qNum = 2;
      startMonth = 3;
      endMonth = 5;
    } else {
      // In Q4 -> last completed was Q3
      qNum = 3;
      startMonth = 6;
      endMonth = 8;
    }

    const startOfQ = new Date(qYear, startMonth, 1, 0, 0, 0, 0);
    const endOfQ = new Date(qYear, endMonth + 1, 0, 23, 59, 59, 999);
    const id = `quarterly:${qYear}-Q${qNum}`;

    const startMName = startOfQ.toLocaleString('en-US', { month: 'short' });
    const endMName = endOfQ.toLocaleString('en-US', { month: 'short' });
    const periodLabel = `Q${qNum} ${qYear} (${startMName} – ${endMName})`;

    return {
      id,
      type: 'quarterly',
      title: 'Your Quarter in Music',
      bannerTitle: 'YOUR QUARTER IN MUSIC',
      periodLabel,
      startTime: startOfQ.getTime(),
      endTime: endOfQ.getTime(),
    };
  }

  /**
   * Half-Year Recap:
   * First Half: Jan-Jun (Avail Jul 1+)
   * Second Half: Jul-Dec (Avail Jan 1+)
   */
  public getCompletedHalfYearPeriod(now: Date = new Date()): RecapPeriodInfo {
    const currentMonth = now.getMonth(); // 0-11
    let hYear = now.getFullYear();
    let hNum = 1;
    let startMonth = 0;
    let endMonth = 5;

    if (currentMonth >= 0 && currentMonth <= 5) {
      // In first half of year -> completed was H2 of prev year
      hYear = now.getFullYear() - 1;
      hNum = 2;
      startMonth = 6;
      endMonth = 11;
    } else {
      // In second half of year -> completed was H1 of this year
      hNum = 1;
      startMonth = 0;
      endMonth = 5;
    }

    const startOfH = new Date(hYear, startMonth, 1, 0, 0, 0, 0);
    const endOfH = new Date(hYear, endMonth + 1, 0, 23, 59, 59, 999);
    const id = `halfyear:${hYear}-H${hNum}`;

    const title = hNum === 1 ? 'Your First Half in Music' : 'Your Second Half in Music';
    const bannerTitle = hNum === 1 ? 'YOUR FIRST HALF IN MUSIC' : 'YOUR SECOND HALF IN MUSIC';
    const periodLabel = hNum === 1 ? `Jan – Jun ${hYear}` : `Jul – Dec ${hYear}`;

    return {
      id,
      type: 'halfyear',
      title,
      bannerTitle,
      periodLabel,
      startTime: startOfH.getTime(),
      endTime: endOfH.getTime(),
    };
  }

  /**
   * Yearly Wrapped: Completed previous calendar year (Jan 1 00:00:00 -> Dec 31 23:59:59)
   */
  public getCompletedYearlyPeriod(now: Date = new Date()): RecapPeriodInfo {
    const prevYear = now.getFullYear() - 1;
    const startOfYear = new Date(prevYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(prevYear, 12, 0, 23, 59, 59, 999);
    const id = `yearly:${prevYear}`;

    return {
      id,
      type: 'yearly',
      title: `${prevYear} Wrapped`,
      bannerTitle: `${prevYear} WRAPPED IS HERE`,
      periodLabel: `${prevYear}`,
      startTime: startOfYear.getTime(),
      endTime: endOfYear.getTime(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. RECAP GENERATION & SNAPSHOT CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates or retrieves from snapshot cache a single complete music recap.
   */
  public async getRecapByPeriod(period: RecapPeriodInfo, userId: string = 'guest'): Promise<MusicRecapData> {
    // 1. Check if snapshot is already cached in memory or localStorage
    const snapshot = this.loadSnapshot(period.id);
    if (snapshot) {
      return snapshot;
    }

    // 2. Aggregate from authoritative ListeningAnalyticsEngine for exact completed range
    const analytics = await ListeningAnalyticsEngine.getInstance().getAnalyticsForRange(
      period.startTime,
      period.endTime,
      userId
    );

    const hasData = analytics.hasData && analytics.overview.totalListeningTimeSec >= 120 && analytics.overview.songsPlayedCount >= 3;

    const persona = this.calculatePersona(
      analytics.languages,
      analytics.dna.topGenre,
      analytics.offlineVsStreamed.offlinePercentage,
      analytics.habits.peakHourOfDay
    );

    const data: MusicRecapData = {
      id: period.id,
      type: period.type,
      title: period.title,
      bannerTitle: period.bannerTitle,
      periodLabel: period.periodLabel,
      startTime: period.startTime,
      endTime: period.endTime,
      generatedAt: Date.now(),
      hasData,
      isRead: false,
      totalListeningTimeSec: analytics.overview.totalListeningTimeSec,
      totalListeningDisplay: analytics.overview.totalListeningDisplay,
      totalSongsPlayed: analytics.overview.songsPlayedCount,
      topSong: analytics.topSongs[0] || null,
      topSongs: analytics.topSongs.slice(0, 5),
      topArtist: analytics.topArtists[0] || null,
      topArtists: analytics.topArtists.slice(0, 5),
      topAlbum: analytics.topAlbums[0] || null,
      topAlbums: analytics.topAlbums.slice(0, 5),
      topGenre: analytics.dna.topGenre || 'Various',
      topLanguage: analytics.dna.topLanguage || 'Telugu',
      languageShares: analytics.languages,
      mostReplayedSong: analytics.mostReplayed[0] || analytics.topSongs[0] || null,
      newArtistsDiscovered: analytics.discovery.newArtistsDiscovered,
      persona,
      habits: analytics.habits,
    };

    // Save snapshot
    this.saveSnapshot(data);
    this.updateIndex(data);

    return data;
  }

  /**
   * Priority Evaluation for Home Banner:
   * 1. Yearly Wrapped
   * 2. Half-Year Recap
   * 3. Quarterly Recap
   * 4. Monthly Recap
   * 5. Weekly Recap
   */
  public async getActiveRecapBanner(userId: string = 'guest'): Promise<MusicRecapData | null> {
    const dismissedMap = this.getDismissedMap();
    const now = new Date();

    const candidates = [
      this.getCompletedYearlyPeriod(now),
      this.getCompletedHalfYearPeriod(now),
      this.getCompletedQuarterlyPeriod(now),
      this.getCompletedMonthlyPeriod(now),
      this.getCompletedWeeklyPeriod(now),
    ];

    for (const period of candidates) {
      if (dismissedMap[period.id]) continue;

      const recap = await this.getRecapByPeriod(period, userId);
      if (recap && recap.hasData) {
        return recap;
      }
    }

    return null;
  }

  /**
   * Retrieves all completed historical recaps grouped by year.
   */
  public async getAllRecapsHistory(userId: string = 'guest'): Promise<{ year: number; recaps: MusicRecapData[] }[]> {
    const now = new Date();
    const periods: RecapPeriodInfo[] = [
      this.getCompletedWeeklyPeriod(now),
      this.getCompletedMonthlyPeriod(now),
      this.getCompletedQuarterlyPeriod(now),
      this.getCompletedHalfYearPeriod(now),
      this.getCompletedYearlyPeriod(now),
    ];

    const results: MusicRecapData[] = [];
    for (const period of periods) {
      const recap = await this.getRecapByPeriod(period, userId);
      if (recap && recap.hasData) {
        results.push(recap);
      }
    }

    // Group by year descending
    const yearGroups: Record<number, MusicRecapData[]> = {};
    for (const item of results) {
      const yr = new Date(item.startTime).getFullYear();
      if (!yearGroups[yr]) yearGroups[yr] = [];
      yearGroups[yr].push(item);
    }

    return Object.entries(yearGroups)
      .map(([yearStr, recaps]) => ({
        year: Number(yearStr),
        recaps: recaps.sort((a, b) => b.endTime - a.endTime),
      }))
      .sort((a, b) => b.year - a.year);
  }

  public markAsDismissed(recapId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const map = this.getDismissedMap();
      map[recapId] = true;
      localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify(map));
    } catch {}
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PERSISTENCE & STORAGE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private getDismissedMap(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_DISMISSED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private loadSnapshot(id: string): MusicRecapData | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_SNAPSHOT_PREFIX}${id}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  private saveSnapshot(data: MusicRecapData): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${STORAGE_SNAPSHOT_PREFIX}${data.id}`, JSON.stringify(data));
    } catch {}
  }

  private updateIndex(data: MusicRecapData): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      const list: RecapMetadata[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter((item) => item.id !== data.id);
      
      const meta: RecapMetadata = {
        id: data.id,
        type: data.type,
        title: data.title,
        bannerTitle: data.bannerTitle,
        periodLabel: data.periodLabel,
        generatedAt: data.generatedAt,
        hasData: data.hasData,
        isRead: data.isRead,
        totalListeningDisplay: data.totalListeningDisplay,
        totalSongsPlayed: data.totalSongsPlayed,
        topSongTitle: data.topSong?.song.title,
        topArtistName: data.topArtist?.name,
        coverUrl: data.topSong?.song.coverUrl || data.topArtist?.coverUrl,
      };

      filtered.push(meta);
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(filtered));
    } catch {}
  }

  private calculatePersona(
    languages: LanguageShare[],
    topGenre: string,
    offlinePercent: number,
    peakHour: string
  ): WrappedPersona {
    if (languages.length >= 3) {
      return {
        title: 'Polyglot Sound Voyager',
        tagline: 'Your ears know no borders.',
        description: `You embraced ${languages.length} distinct regional languages, refusing to stay confined to a single musical world.`,
        gradient: 'from-purple-600 via-indigo-600 to-pink-600',
        badge: '🌐 Explorer',
      };
    }

    if (offlinePercent >= 40) {
      return {
        title: 'Nomadic Audiophile',
        tagline: 'Always prepared, always in high fidelity.',
        description: `${offlinePercent}% of your listening was played completely offline from your private sandbox library.`,
        gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
        badge: '💾 Sandbox Master',
      };
    }

    if (peakHour.includes('PM') || peakHour.includes('Night') || peakHour.includes('11') || peakHour.includes('10')) {
      return {
        title: 'Midnight Melodist',
        tagline: 'Music comes alive when the world goes quiet.',
        description: 'Your highest listening peaks occurred late into the night, soundtracking quiet hours with deep melodies.',
        gradient: 'from-blue-600 via-indigo-900 to-purple-900',
        badge: '🌙 Night Owl',
      };
    }

    return {
      title: 'Melody Connoisseur',
      tagline: 'Pure devotion to musical craft.',
      description: 'You appreciate rich compositions, heartfelt vocals, and timeless soundtrack melodies.',
      gradient: 'from-rose-600 via-red-600 to-orange-600',
      badge: '🎵 Connoisseur',
    };
  }
}
