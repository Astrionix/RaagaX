import { Song } from '@/types/music';
import { 
  ListeningAnalyticsEngine, 
  RankedSongItem, 
  RankedArtistItem, 
  RankedAlbumItem, 
  LanguageShare 
} from './ListeningAnalyticsEngine';
import { QueueHistory } from '@/lib/queue/QueueHistory';

export interface WrappedPersona {
  title: string;
  tagline: string;
  description: string;
  gradient: string;
  badge: string;
}

export interface WrappedData {
  year: number;
  hasData: boolean;
  totalListeningTimeSec: number;
  totalListeningDisplay: string;
  totalSongsPlayed: number;
  topSong: RankedSongItem | null;
  top10Songs: RankedSongItem[];
  topArtist: RankedArtistItem | null;
  topArtists: RankedArtistItem[];
  topAlbum: RankedAlbumItem | null;
  topAlbums: RankedAlbumItem[];
  topGenre: string;
  topLanguage: string;
  languageShares: LanguageShare[];
  mostReplayedSong: RankedSongItem | null;
  firstSongOfYear: Song | null;
  mostActiveMonth: string;
  mostActiveDayAndTime: string;
  newArtistsDiscovered: number;
  downloadedPercentage: number;
  streamedPercentage: number;
  persona: WrappedPersona;
}

export class WrappedGenerator {
  private static instance: WrappedGenerator;

  private constructor() {}

  public static getInstance(): WrappedGenerator {
    if (!WrappedGenerator.instance) {
      WrappedGenerator.instance = new WrappedGenerator();
    }
    return WrappedGenerator.instance;
  }

  public async generateWrapped(userId: string = 'guest', year: number = 2026): Promise<WrappedData> {
    // 1. Fetch Year/All analytics snapshot from authoritative ListeningAnalyticsEngine
    const analytics = await ListeningAnalyticsEngine.getInstance().getAnalytics(userId, '1year');
    
    if (!analytics.hasData || analytics.overview.songsPlayedCount === 0) {
      return this.generateEmptyWrapped(year);
    }

    // 2. Fetch queue history to extract chronological details (e.g. first song of year)
    const historyEntries = await QueueHistory.getInstance().ensureLoaded();
    const firstEntry = historyEntries.find(e => e.song && e.song.id);
    const firstSong = firstEntry ? firstEntry.song : (analytics.topSongs[0]?.song || null);

    const topSong = analytics.topSongs[0] || null;
    const topArtist = analytics.topArtists[0] || null;
    const topAlbum = analytics.topAlbums[0] || null;
    const mostReplayedSong = analytics.mostReplayed[0] || topSong;

    const persona = this.calculatePersona(
      analytics.languages,
      analytics.dna.topGenre,
      analytics.offlineVsStreamed.offlinePercentage,
      analytics.habits.peakHourOfDay
    );

    const peakDay = analytics.habits.mostActiveDayOfWeek;
    const peakHour = analytics.dna.peakTimeRange;
    const mostActiveDayAndTime = `${peakDay}s at ${peakHour.split('–')[0]?.trim() || '8 PM'}`;

    return {
      year,
      hasData: true,
      totalListeningTimeSec: analytics.overview.totalListeningTimeSec,
      totalListeningDisplay: analytics.overview.totalListeningDisplay,
      totalSongsPlayed: analytics.overview.songsPlayedCount,
      topSong,
      top10Songs: analytics.topSongs,
      topArtist,
      topArtists: analytics.topArtists,
      topAlbum,
      topAlbums: analytics.topAlbums,
      topGenre: analytics.dna.topGenre,
      topLanguage: analytics.dna.topLanguage,
      languageShares: analytics.languages,
      mostReplayedSong,
      firstSongOfYear: firstSong,
      mostActiveMonth: analytics.habits.mostActiveMonth,
      mostActiveDayAndTime,
      newArtistsDiscovered: analytics.discovery.newArtistsDiscovered,
      downloadedPercentage: analytics.offlineVsStreamed.offlinePercentage,
      streamedPercentage: analytics.offlineVsStreamed.streamedPercentage,
      persona,
    };
  }

  private calculatePersona(
    languages: LanguageShare[],
    topGenre: string,
    offlinePercent: number,
    peakHour: string
  ): WrappedPersona {
    // Multi-Language Voyager
    if (languages.length >= 3) {
      return {
        title: 'Polyglot Sound Voyager',
        tagline: 'Your ears know no borders.',
        description: `You embraced ${languages.length} distinct regional languages this year, refusing to stay confined to a single musical world.`,
        gradient: 'from-purple-600 via-indigo-600 to-pink-600',
        badge: '🌐 Explorer',
      };
    }

    // Offline Audiophile
    if (offlinePercent >= 50) {
      return {
        title: 'Nomadic Audiophile',
        tagline: 'Always prepared, always in high fidelity.',
        description: `${offlinePercent}% of your listening happened completely offline in private sandbox storage.`,
        gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
        badge: '💾 Sandbox Master',
      };
    }

    // Night Owl
    if (peakHour.includes('PM') || peakHour.includes('Night') || peakHour.includes('11') || peakHour.includes('10')) {
      return {
        title: 'Midnight Melodist',
        tagline: 'Music comes alive when the world goes quiet.',
        description: 'Your highest listening peaks occurred late into the night, soundtracking late hours with deep melodies.',
        gradient: 'from-blue-600 via-indigo-900 to-purple-900',
        badge: '🌙 Night Owl',
      };
    }

    // Default Melody Alchemist
    return {
      title: 'Melody Alchemist',
      tagline: 'Pure emotion, perfect harmonies.',
      description: `Your heart beats to the rhythm of ${topGenre} hits and heartfelt lyrical journeys.`,
      gradient: 'from-[#FA233B] via-rose-600 to-amber-600',
      badge: '✨ Pure Soul',
    };
  }

  private generateEmptyWrapped(year: number): WrappedData {
    return {
      year,
      hasData: false,
      totalListeningTimeSec: 0,
      totalListeningDisplay: '0m',
      totalSongsPlayed: 0,
      topSong: null,
      top10Songs: [],
      topArtist: null,
      topArtists: [],
      topAlbum: null,
      topAlbums: [],
      topGenre: 'Melody',
      topLanguage: 'Telugu',
      languageShares: [],
      mostReplayedSong: null,
      firstSongOfYear: null,
      mostActiveMonth: 'Recent',
      mostActiveDayAndTime: 'Evening',
      newArtistsDiscovered: 0,
      downloadedPercentage: 0,
      streamedPercentage: 100,
      persona: {
        title: 'Emerging Listener',
        tagline: 'Your musical story is just beginning.',
        description: 'Start streaming or downloading songs on RaagaX to unlock your full yearly recap.',
        gradient: 'from-slate-700 to-slate-900',
        badge: '🌱 Fresh Start',
      },
    };
  }
}
