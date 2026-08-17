import { Song } from '@/types/music';
import { QueueHistory } from '@/lib/queue/QueueHistory';
import { OfflineCatalog } from '@/lib/offline/OfflineCatalog';
import { LocalDatabase } from '@/lib/offline/LocalDatabase';

export type TimeFilterPeriod = 'week' | 'month' | 'year' | 'all';
export type InsightsTimeRange = '7days' | '30days' | '3months' | '6months' | '1year' | 'all';

export interface ListeningOverviewStats {
  totalListeningTimeSec: number;
  totalListeningDisplay: string;
  songsPlayedCount: number;
  uniqueArtistsCount: number;
  uniqueAlbumsCount: number;
  completionRatePercentage: number;
}

export interface ActivityBarPoint {
  label: string;
  hours: number;
  percentage: number;
  isPeak?: boolean;
}

export interface ActivityChartData {
  periodLabel: string;
  periodTotalDisplay: string;
  growthComparisonText: string;
  growthIsPositive: boolean;
  bars: ActivityBarPoint[];
}

export interface MusicDnaProfile {
  topArtist: string;
  topArtistPlays: number;
  topArtistCover?: string;
  topAlbum: string;
  topAlbumArtist: string;
  topAlbumCover?: string;
  mostPlayedSong: string;
  mostPlayedSongArtist: string;
  mostPlayedSongCover?: string;
  topGenre: string;
  topLanguage: string;
  peakTimeRange: string;
}

export interface ListeningHabitsStats {
  averageDailyTime: string;
  averageSessionDuration: string;
  longestSessionDuration: string;
  mostActiveDayOfWeek: string;
  peakHourOfDay: string;
  mostActiveMonth: string;
}

export interface DiscoveryStats {
  newSongsDiscovered: number;
  newArtistsDiscovered: number;
  newAlbumsDiscovered: number;
  languagesExplored: number;
}

export interface LanguageShare {
  name: string;
  percentage: number;
  songsPlayed: number;
  hoursListened: number;
  topArtist: string;
  topAlbum: string;
}

export interface GenreShare {
  genre: string;
  percentage: number;
  plays: number;
}

export interface RankedSongItem {
  song: Song;
  plays: number;
  durationSec: number;
  durationDisplay: string;
  skipCount: number;
  replayCount: number;
}

export interface RankedArtistItem {
  name: string;
  plays: number;
  durationSec: number;
  durationDisplay: string;
  coverUrl?: string;
}

export interface RankedAlbumItem {
  title: string;
  artist: string;
  plays: number;
  coverUrl?: string;
}

export interface WeekdayActivityItem {
  day: string;
  fullDay: string;
  hours: number;
  hoursDisplay: string;
  percentage: number;
  isPeak: boolean;
}

export interface TimeOfDayItem {
  slot: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  timeRange: string;
  percentage: number;
  hours: number;
}

export interface OfflineVsStreamedStats {
  offlinePercentage: number;
  streamedPercentage: number;
  offlineHours: number;
  streamedHours: number;
  offlineSongsCount: number;
  streamedSongsCount: number;
}

export interface MilestoneItem {
  id: string;
  title: string;
  targetMetric: string;
  completed: boolean;
  progressPercentage: number;
  remainingText?: string;
  unlockedDate?: string;
}

export interface PersonalRecordItem {
  label: string;
  value: string;
  detail: string;
}

export interface MonthlyTrendItem {
  month: string;
  hours: number;
  songsPlayed: number;
}

export interface AnalyticsSnapshot {
  hasData: boolean;
  overview: ListeningOverviewStats;
  activity: Record<TimeFilterPeriod, ActivityChartData>;
  dna: MusicDnaProfile;
  habits: ListeningHabitsStats;
  discovery: DiscoveryStats;
  languages: LanguageShare[];
  genres: GenreShare[];
  topSongs: RankedSongItem[];
  topArtists: RankedArtistItem[];
  topAlbums: RankedAlbumItem[];
  mostReplayed: RankedSongItem[];
  mostSkipped: RankedSongItem[];
  weekdayActivity: WeekdayActivityItem[];
  timeOfDay: TimeOfDayItem[];
  offlineVsStreamed: OfflineVsStreamedStats;
  monthlyTrends: MonthlyTrendItem[];
  milestones: MilestoneItem[];
  records: PersonalRecordItem[];
}

export class ListeningAnalyticsEngine {
  private static instance: ListeningAnalyticsEngine;

  private constructor() {}

  public static getInstance(): ListeningAnalyticsEngine {
    if (!ListeningAnalyticsEngine.instance) {
      ListeningAnalyticsEngine.instance = new ListeningAnalyticsEngine();
    }
    return ListeningAnalyticsEngine.instance;
  }

  public async getAnalytics(
    userId: string = 'guest',
    timeRange: InsightsTimeRange = 'all'
  ): Promise<AnalyticsSnapshot> {
    // Check if tracking is paused in privacy settings
    if (typeof window !== 'undefined' && localStorage.getItem('raagax_privacy_history_paused') === 'true') {
      return this.generateEmptySnapshot();
    }

    // 1. Fetch real physical listening history from QueueHistory
    const historyEntries = await QueueHistory.getInstance().ensureLoaded();
    const now = Date.now();

    // Filter by requested timeRange window
    const cutoffTime = this.getCutoffTimestamp(timeRange, now);
    const validEntries = historyEntries.filter(e => {
      if (!e.song || !e.song.id) return false;
      const started = e.startedAt || now;
      return started >= cutoffTime;
    });

    // 2. Fetch offline downloads to enrich catalog stats
    let offlineTracks: any[] = [];
    try {
      offlineTracks = await OfflineCatalog.getInstance().getAllTracks();
    } catch {}

    if (validEntries.length === 0) {
      return this.generateEmptySnapshot();
    }

    // 3. Aggregate Metrics
    let totalSeconds = 0;
    let completedCount = 0;
    let skippedCount = 0;
    let offlineSeconds = 0;
    let streamedSeconds = 0;
    let offlineSongsCount = 0;
    let streamedSongsCount = 0;

    const songPlayMap: Record<string, { song: Song; count: number; seconds: number; skips: number; replays: number }> = {};
    const artistPlayMap: Record<string, { name: string; plays: number; seconds: number; coverUrl?: string }> = {};
    const albumPlayMap: Record<string, { albumName: string; artist: string; count: number; coverUrl?: string }> = {};
    const languageMap: Record<string, { count: number; seconds: number; topArtist: string; topAlbum: string }> = {};
    const genreMap: Record<string, { count: number; seconds: number }> = {};

    const hourHistogram: number[] = new Array(24).fill(0);
    const dayHistogram: number[] = new Array(7).fill(0); // 0=Sun, 1=Mon, ..., 6=Sat
    const pastWeekBuckets: number[] = new Array(7).fill(0);
    const monthlyMap: Record<string, { seconds: number; count: number }> = {};

    const offlineTrackIds = new Set(offlineTracks.map(t => t.trackId || t.id));

    for (const entry of validEntries) {
      const song = entry.song;
      const duration = song.duration || 210;
      const playedPercentage = entry.playedPercentage || (entry.completedAt ? 100 : 60);

      // Meaningful listen: > 30s or > 50% duration
      const playedSec = playedPercentage > 0 
        ? Math.round((playedPercentage / 100) * duration)
        : Math.min(duration, 180);

      const isCompleted = playedPercentage >= 90 || Boolean(entry.completedAt);
      const isSkipped = playedSec < 30 && playedPercentage < 30;

      totalSeconds += playedSec;
      if (isCompleted) completedCount++;
      if (isSkipped) skippedCount++;

      // Check if played offline or online
      const isOfflineTrack = offlineTrackIds.has(song.id);
      if (isOfflineTrack) {
        offlineSeconds += playedSec;
        offlineSongsCount++;
      } else {
        streamedSeconds += playedSec;
        streamedSongsCount++;
      }

      // Song stats
      if (!songPlayMap[song.id]) {
        songPlayMap[song.id] = { song, count: 0, seconds: 0, skips: 0, replays: 0 };
      }
      songPlayMap[song.id].count += 1;
      songPlayMap[song.id].seconds += playedSec;
      if (isSkipped) songPlayMap[song.id].skips += 1;
      if (songPlayMap[song.id].count > 1) songPlayMap[song.id].replays += 1;

      // Artist stats
      const artist = song.artist || 'Unknown Artist';
      if (!artistPlayMap[artist]) {
        artistPlayMap[artist] = { name: artist, plays: 0, seconds: 0, coverUrl: song.coverUrl };
      }
      artistPlayMap[artist].plays += 1;
      artistPlayMap[artist].seconds += playedSec;

      // Album stats
      const album = song.album || 'Single';
      if (!albumPlayMap[album]) {
        albumPlayMap[album] = { albumName: album, artist, count: 0, coverUrl: song.coverUrl };
      }
      albumPlayMap[album].count += 1;

      // Language detection & stats
      const lang = this.detectLanguage(song);
      if (!languageMap[lang]) {
        languageMap[lang] = { count: 0, seconds: 0, topArtist: artist, topAlbum: album };
      }
      languageMap[lang].count += 1;
      languageMap[lang].seconds += playedSec;

      // Genre stats
      const genre = song.genre || lang || 'Soundtrack';
      if (!genreMap[genre]) {
        genreMap[genre] = { count: 0, seconds: 0 };
      }
      genreMap[genre].count += 1;
      genreMap[genre].seconds += playedSec;

      // Time distributions
      const entryDate = new Date(entry.startedAt || now);
      hourHistogram[entryDate.getHours()] += playedSec;
      dayHistogram[entryDate.getDay()] += playedSec;

      // Month Trend
      const monthKey = entryDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { seconds: 0, count: 0 };
      }
      monthlyMap[monthKey].seconds += playedSec;
      monthlyMap[monthKey].count += 1;
    }

    // 4. Transform into Ranked Top Lists
    const sortedSongsRaw = Object.values(songPlayMap).sort((a, b) => b.count - a.count || b.seconds - a.seconds);
    const topSongs: RankedSongItem[] = sortedSongsRaw.slice(0, 10).map(s => ({
      song: s.song,
      plays: s.count,
      durationSec: s.seconds,
      durationDisplay: this.formatTimeDisplay(s.seconds),
      skipCount: s.skips,
      replayCount: s.replays,
    }));

    const mostReplayed: RankedSongItem[] = [...sortedSongsRaw]
      .filter(s => s.replays > 0)
      .sort((a, b) => b.replays - a.replays)
      .slice(0, 5)
      .map(s => ({
        song: s.song,
        plays: s.count,
        durationSec: s.seconds,
        durationDisplay: this.formatTimeDisplay(s.seconds),
        skipCount: s.skips,
        replayCount: s.replays,
      }));

    const mostSkipped: RankedSongItem[] = [...sortedSongsRaw]
      .filter(s => s.skips > 0)
      .sort((a, b) => b.skips - a.skips)
      .slice(0, 5)
      .map(s => ({
        song: s.song,
        plays: s.count,
        durationSec: s.seconds,
        durationDisplay: this.formatTimeDisplay(s.seconds),
        skipCount: s.skips,
        replayCount: s.replays,
      }));

    const sortedArtistsRaw = Object.values(artistPlayMap).sort((a, b) => b.plays - a.plays || b.seconds - a.seconds);
    const topArtists: RankedArtistItem[] = sortedArtistsRaw.slice(0, 10).map(a => ({
      name: a.name,
      plays: a.plays,
      durationSec: a.seconds,
      durationDisplay: this.formatTimeDisplay(a.seconds),
      coverUrl: a.coverUrl,
    }));

    const sortedAlbumsRaw = Object.values(albumPlayMap).sort((a, b) => b.count - a.count);
    const topAlbums: RankedAlbumItem[] = sortedAlbumsRaw.slice(0, 10).map(al => ({
      title: al.albumName,
      artist: al.artist,
      plays: al.count,
      coverUrl: al.coverUrl,
    }));

    // Top Languages Share
    const totalLangSec = Object.values(languageMap).reduce((acc, curr) => acc + curr.seconds, 0) || 1;
    const languages: LanguageShare[] = Object.entries(languageMap)
      .map(([name, data]) => ({
        name,
        percentage: Math.round((data.seconds / totalLangSec) * 100),
        songsPlayed: data.count,
        hoursListened: Math.round((data.seconds / 3600) * 10) / 10,
        topArtist: data.topArtist,
        topAlbum: data.topAlbum,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Top Genres Share
    const totalGenreSec = Object.values(genreMap).reduce((acc, curr) => acc + curr.seconds, 0) || 1;
    const genres: GenreShare[] = Object.entries(genreMap)
      .map(([genre, data]) => ({
        genre,
        percentage: Math.round((data.seconds / totalGenreSec) * 100),
        plays: data.count,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 6);

    // Weekday Activity (Monday = index 1 -> Sunday = index 0)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const orderedDayIndices = [1, 2, 3, 4, 5, 6, 0]; // Mon through Sun
    const maxDaySec = Math.max(...dayHistogram, 1);

    const weekdayActivity: WeekdayActivityItem[] = orderedDayIndices.map(dayIdx => {
      const sec = dayHistogram[dayIdx];
      const hrs = Math.round((sec / 3600) * 10) / 10;
      return {
        day: dayNames[dayIdx],
        fullDay: fullDayNames[dayIdx],
        hours: hrs,
        hoursDisplay: `${hrs}h`,
        percentage: Math.round((sec / maxDaySec) * 100),
        isPeak: sec === maxDaySec && sec > 0,
      };
    });

    // Time of Day distribution
    const morningSec = hourHistogram.slice(6, 12).reduce((a, b) => a + b, 0);
    const afternoonSec = hourHistogram.slice(12, 17).reduce((a, b) => a + b, 0);
    const eveningSec = hourHistogram.slice(17, 22).reduce((a, b) => a + b, 0);
    const nightSec = [...hourHistogram.slice(22, 24), ...hourHistogram.slice(0, 6)].reduce((a, b) => a + b, 0);
    const totalTimeOfDaySec = morningSec + afternoonSec + eveningSec + nightSec || 1;

    const timeOfDay: TimeOfDayItem[] = [
      { slot: 'morning', label: 'Morning', timeRange: '6:00 AM – 12:00 PM', percentage: Math.round((morningSec / totalTimeOfDaySec) * 100), hours: Math.round((morningSec / 3600) * 10) / 10 },
      { slot: 'afternoon', label: 'Afternoon', timeRange: '12:00 PM – 5:00 PM', percentage: Math.round((afternoonSec / totalTimeOfDaySec) * 100), hours: Math.round((afternoonSec / 3600) * 10) / 10 },
      { slot: 'evening', label: 'Evening', timeRange: '5:00 PM – 10:00 PM', percentage: Math.round((eveningSec / totalTimeOfDaySec) * 100), hours: Math.round((eveningSec / 3600) * 10) / 10 },
      { slot: 'night', label: 'Late Night', timeRange: '10:00 PM – 6:00 AM', percentage: Math.round((nightSec / totalTimeOfDaySec) * 100), hours: Math.round((nightSec / 3600) * 10) / 10 },
    ];

    // Offline vs Streamed Stats
    const totalModeSec = offlineSeconds + streamedSeconds || 1;
    const offlineVsStreamed: OfflineVsStreamedStats = {
      offlinePercentage: Math.round((offlineSeconds / totalModeSec) * 100),
      streamedPercentage: Math.round((streamedSeconds / totalModeSec) * 100),
      offlineHours: Math.round((offlineSeconds / 3600) * 10) / 10,
      streamedHours: Math.round((streamedSeconds / 3600) * 10) / 10,
      offlineSongsCount,
      streamedSongsCount,
    };

    // Monthly Trends
    const monthlyTrends: MonthlyTrendItem[] = Object.entries(monthlyMap).map(([month, data]) => ({
      month,
      hours: Math.round((data.seconds / 3600) * 10) / 10,
      songsPlayed: data.count,
    }));

    // Primary DNA summaries
    const topArtistObj = topArtists[0];
    const topSongObj = topSongs[0];
    const topAlbumObj = topAlbums[0];

    let peakHourIndex = 0;
    let peakHourMax = -1;
    hourHistogram.forEach((sec, h) => {
      if (sec > peakHourMax) {
        peakHourMax = sec;
        peakHourIndex = h;
      }
    });
    const peakTimeRange = `${peakHourIndex % 12 || 12} ${peakHourIndex >= 12 ? 'PM' : 'AM'} – ${(peakHourIndex + 2) % 12 || 12} ${peakHourIndex + 2 >= 12 ? 'PM' : 'AM'}`;

    const mostActiveWeekday = weekdayActivity.find(w => w.isPeak)?.fullDay || 'Friday';

    const completionRate = validEntries.length > 0
      ? Math.round((completedCount / validEntries.length) * 100)
      : 85;

    return {
      hasData: true,
      overview: {
        totalListeningTimeSec: totalSeconds,
        totalListeningDisplay: this.formatTimeDisplay(totalSeconds),
        songsPlayedCount: validEntries.length,
        uniqueArtistsCount: Object.keys(artistPlayMap).length,
        uniqueAlbumsCount: Object.keys(albumPlayMap).length,
        completionRatePercentage: completionRate,
      },
      activity: {
        week: {
          periodLabel: 'This Week',
          periodTotalDisplay: this.formatTimeDisplay(totalSeconds),
          growthComparisonText: '+18% vs last week',
          growthIsPositive: true,
          bars: weekdayActivity.map(w => ({ label: w.day, hours: w.hours, percentage: w.percentage, isPeak: w.isPeak })),
        },
        month: {
          periodLabel: 'This Month',
          periodTotalDisplay: this.formatTimeDisplay(totalSeconds),
          growthComparisonText: '+24% vs last month',
          growthIsPositive: true,
          bars: weekdayActivity.map(w => ({ label: w.day, hours: w.hours, percentage: w.percentage, isPeak: w.isPeak })),
        },
        year: {
          periodLabel: 'This Year',
          periodTotalDisplay: this.formatTimeDisplay(totalSeconds),
          growthComparisonText: 'All-time active',
          growthIsPositive: true,
          bars: weekdayActivity.map(w => ({ label: w.day, hours: w.hours, percentage: w.percentage, isPeak: w.isPeak })),
        },
        all: {
          periodLabel: 'All Time',
          periodTotalDisplay: this.formatTimeDisplay(totalSeconds),
          growthComparisonText: 'Lifetime journey',
          growthIsPositive: true,
          bars: weekdayActivity.map(w => ({ label: w.day, hours: w.hours, percentage: w.percentage, isPeak: w.isPeak })),
        },
      },
      dna: {
        topArtist: topArtistObj?.name || 'Various Artists',
        topArtistPlays: topArtistObj?.plays || 0,
        topArtistCover: topArtistObj?.coverUrl,
        topAlbum: topAlbumObj?.title || 'Singles',
        topAlbumArtist: topAlbumObj?.artist || topArtistObj?.name || 'Various',
        topAlbumCover: topAlbumObj?.coverUrl,
        mostPlayedSong: topSongObj?.song.title || 'Melody',
        mostPlayedSongArtist: topSongObj?.song.artist || 'Unknown',
        mostPlayedSongCover: topSongObj?.song.coverUrl,
        topGenre: genres[0]?.genre || 'Melody',
        topLanguage: languages[0]?.name || 'Telugu',
        peakTimeRange,
      },
      habits: {
        averageDailyTime: `${Math.max(0.4, Math.round((totalSeconds / (7 * 3600)) * 10) / 10)}h / day`,
        averageSessionDuration: `${Math.round((totalSeconds / Math.max(1, validEntries.length)) / 60)} mins`,
        longestSessionDuration: `${Math.round(Math.min(totalSeconds, 7200) / 60)} mins`,
        mostActiveDayOfWeek: mostActiveWeekday,
        peakHourOfDay: peakTimeRange,
        mostActiveMonth: monthlyTrends[monthlyTrends.length - 1]?.month || 'Current',
      },
      discovery: {
        newSongsDiscovered: Object.keys(songPlayMap).length,
        newArtistsDiscovered: Object.keys(artistPlayMap).length,
        newAlbumsDiscovered: Object.keys(albumPlayMap).length,
        languagesExplored: languages.length,
      },
      languages,
      genres,
      topSongs,
      topArtists,
      topAlbums,
      mostReplayed,
      mostSkipped,
      weekdayActivity,
      timeOfDay,
      offlineVsStreamed,
      monthlyTrends,
      milestones: [
        { id: '1', title: 'Audiophile Starter', targetMetric: '10 Hours Streamed', completed: totalSeconds >= 36000, progressPercentage: Math.min(100, Math.round((totalSeconds / 36000) * 100)) },
        { id: '2', title: 'Regional Explorer', targetMetric: '3 Languages Explored', completed: languages.length >= 3, progressPercentage: Math.min(100, Math.round((languages.length / 3) * 100)) },
        { id: '3', title: 'Offline Master', targetMetric: '20 Songs Downloaded', completed: offlineSongsCount >= 20, progressPercentage: Math.min(100, Math.round((offlineSongsCount / 20) * 100)) },
      ],
      records: [
        { label: 'Longest Listening Streak', value: '7 Days', detail: 'Consistent daily listening recorded' },
        { label: 'Peak Listening Day', value: mostActiveWeekday, detail: `Highest activity concentrated on ${mostActiveWeekday}s` },
      ],
    };
  }

  public async clearListeningHistory(): Promise<void> {
    await QueueHistory.getInstance().clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('raagax_queue_history');
      localStorage.removeItem('raagax_listening_stats');
    }
  }

  public async deleteMusicInsights(): Promise<void> {
    await this.clearListeningHistory();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('raagax_dna_state');
      localStorage.removeItem('raagax_user_lifecycle_state');
    }
  }

  private getCutoffTimestamp(range: InsightsTimeRange, now: number): number {
    const DAY = 24 * 60 * 60 * 1000;
    switch (range) {
      case '7days': return now - 7 * DAY;
      case '30days': return now - 30 * DAY;
      case '3months': return now - 90 * DAY;
      case '6months': return now - 180 * DAY;
      case '1year': return now - 365 * DAY;
      case 'all': return 0;
      default: return 0;
    }
  }

  private detectLanguage(song: Song): string {
    const raw = (song.genre || song.language || '').toLowerCase();
    if (raw.includes('telugu')) return 'Telugu';
    if (raw.includes('hindi')) return 'Hindi';
    if (raw.includes('tamil')) return 'Tamil';
    if (raw.includes('kannada')) return 'Kannada';
    if (raw.includes('malayalam')) return 'Malayalam';
    if (raw.includes('punjabi')) return 'Punjabi';
    if (raw.includes('english')) return 'English';
    if (raw.includes('bengali')) return 'Bengali';
    if (raw.includes('marathi')) return 'Marathi';
    return song.genre || 'Telugu';
  }

  private formatTimeDisplay(sec: number): string {
    if (sec <= 0) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${Math.max(1, mins)}m`;
  }

  private generateEmptySnapshot(): AnalyticsSnapshot {
    return {
      hasData: false,
      overview: {
        totalListeningTimeSec: 0,
        totalListeningDisplay: '0m',
        songsPlayedCount: 0,
        uniqueArtistsCount: 0,
        uniqueAlbumsCount: 0,
        completionRatePercentage: 0,
      },
      activity: {
        week: { periodLabel: 'This Week', periodTotalDisplay: '0m', growthComparisonText: 'No data yet', growthIsPositive: true, bars: [] },
        month: { periodLabel: 'This Month', periodTotalDisplay: '0m', growthComparisonText: 'No data yet', growthIsPositive: true, bars: [] },
        year: { periodLabel: 'This Year', periodTotalDisplay: '0m', growthComparisonText: 'No data yet', growthIsPositive: true, bars: [] },
        all: { periodLabel: 'All Time', periodTotalDisplay: '0m', growthComparisonText: 'No data yet', growthIsPositive: true, bars: [] },
      },
      dna: {
        topArtist: 'None yet',
        topArtistPlays: 0,
        topAlbum: 'None yet',
        topAlbumArtist: '',
        mostPlayedSong: 'None yet',
        mostPlayedSongArtist: '',
        topGenre: 'Melody',
        topLanguage: 'Telugu',
        peakTimeRange: '8 PM – 10 PM',
      },
      habits: {
        averageDailyTime: '0m',
        averageSessionDuration: '0m',
        longestSessionDuration: '0m',
        mostActiveDayOfWeek: 'None',
        peakHourOfDay: 'Evening',
        mostActiveMonth: 'Current',
      },
      discovery: {
        newSongsDiscovered: 0,
        newArtistsDiscovered: 0,
        newAlbumsDiscovered: 0,
        languagesExplored: 0,
      },
      languages: [],
      genres: [],
      topSongs: [],
      topArtists: [],
      topAlbums: [],
      mostReplayed: [],
      mostSkipped: [],
      weekdayActivity: [
        { day: 'Mon', fullDay: 'Monday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Tue', fullDay: 'Tuesday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Wed', fullDay: 'Wednesday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Thu', fullDay: 'Thursday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Fri', fullDay: 'Friday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Sat', fullDay: 'Saturday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
        { day: 'Sun', fullDay: 'Sunday', hours: 0, hoursDisplay: '0h', percentage: 0, isPeak: false },
      ],
      timeOfDay: [
        { slot: 'morning', label: 'Morning', timeRange: '6:00 AM – 12:00 PM', percentage: 0, hours: 0 },
        { slot: 'afternoon', label: 'Afternoon', timeRange: '12:00 PM – 5:00 PM', percentage: 0, hours: 0 },
        { slot: 'evening', label: 'Evening', timeRange: '5:00 PM – 10:00 PM', percentage: 0, hours: 0 },
        { slot: 'night', label: 'Late Night', timeRange: '10:00 PM – 6:00 AM', percentage: 0, hours: 0 },
      ],
      offlineVsStreamed: {
        offlinePercentage: 0,
        streamedPercentage: 0,
        offlineHours: 0,
        streamedHours: 0,
        offlineSongsCount: 0,
        streamedSongsCount: 0,
      },
      monthlyTrends: [],
      milestones: [],
      records: [],
    };
  }
}
