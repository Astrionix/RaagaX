import { HomePayload, HomeSection, ShelfItem } from '@/types/home';
import dynamicPlaylistsData from '@/lib/dynamic_home_playlists.json';
import cachedArtistsData from '@/lib/cached_artists.json';

const dynamicPlaylists = dynamicPlaylistsData as Record<string, any>;
const cachedArtists = cachedArtistsData as Record<string, any[]>;

// Top artist seeds for languages where dynamic catalog has artists
const SEED_ARTISTS_BY_LANG: Record<string, { id: string; name: string; imageUrl: string }[]> = {
  Telugu: [
    { id: '456269', name: 'A.R. Rahman', imageUrl: 'https://c.saavncdn.com/artists/A_R_Rahman_002_20210322074345_500x500.jpg' },
    { id: '464654', name: 'Thaman S', imageUrl: 'https://c.saavncdn.com/artists/S_Thaman_002_20201029111818_500x500.jpg' },
    { id: '456044', name: 'Devi Sri Prasad', imageUrl: 'https://c.saavncdn.com/artists/Devi_Sri_Prasad_002_20201029111559_500x500.jpg' },
    { id: '464627', name: 'Anirudh Ravichander', imageUrl: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_002_20230104094030_500x500.jpg' },
    { id: '458712', name: 'G.V. Prakash Kumar', imageUrl: 'https://c.saavncdn.com/artists/G_V_Prakash_Kumar_002_20210322080351_500x500.jpg' },
    { id: '458742', name: 'Mickey J. Meyer', imageUrl: 'https://c.saavncdn.com/artists/Mickey_J_Meyer_002_20201029111923_500x500.jpg' },
    { id: '455582', name: 'M. M. Keeravani', imageUrl: 'https://c.saavncdn.com/artists/M_M_Keeravani_002_20230104093845_500x500.jpg' },
    { id: '462319', name: 'Anup Rubens', imageUrl: 'https://c.saavncdn.com/artists/Anup_Rubens_002_20201029111756_500x500.jpg' },
    { id: '689580', name: 'Sid Sriram', imageUrl: 'https://c.saavncdn.com/artists/Sid_Sriram_003_20230104093817_500x500.jpg' },
    { id: '455132', name: 'S. P. Balasubrahmanyam', imageUrl: 'https://c.saavncdn.com/artists/S_P_Balasubrahmanyam_003_20200925102558_500x500.jpg' },
  ],
  Hindi: [
    { id: '459320', name: 'Arijit Singh', imageUrl: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' },
    { id: '456269', name: 'A.R. Rahman', imageUrl: 'https://c.saavncdn.com/artists/A_R_Rahman_002_20210322074345_500x500.jpg' },
    { id: '456323', name: 'Pritam', imageUrl: 'https://c.saavncdn.com/artists/Pritam_002_20200810103947_500x500.jpg' },
    { id: '456863', name: 'Shreya Ghoshal', imageUrl: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20230104093405_500x500.jpg' },
    { id: '455125', name: 'Vishal-Shekhar', imageUrl: 'https://c.saavncdn.com/artists/Vishal-Shekhar_20191130071357_500x500.jpg' },
    { id: '456306', name: 'Mithoon', imageUrl: 'https://c.saavncdn.com/artists/Mithoon_002_20200908073735_500x500.jpg' },
    { id: '458739', name: 'Sachin-Jigar', imageUrl: 'https://c.saavncdn.com/artists/Sachin_Jigar_003_20251222093820_500x500.jpg' },
    { id: '458925', name: 'Amit Trivedi', imageUrl: 'https://c.saavncdn.com/artists/Amit_Trivedi_002_20201029111956_500x500.jpg' },
  ],
  Tamil: [
    { id: '464627', name: 'Anirudh Ravichander', imageUrl: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_002_20230104094030_500x500.jpg' },
    { id: '456269', name: 'A.R. Rahman', imageUrl: 'https://c.saavncdn.com/artists/A_R_Rahman_002_20210322074345_500x500.jpg' },
    { id: '455584', name: 'Yuvan Shankar Raja', imageUrl: 'https://c.saavncdn.com/artists/Yuvan_Shankar_Raja_002_20180802174245_500x500.jpg' },
    { id: '459124', name: 'Santhosh Narayanan', imageUrl: 'https://c.saavncdn.com/artists/Santhosh_Narayanan_002_20250527101718_500x500.jpg' },
    { id: '455583', name: 'Harris Jayaraj', imageUrl: 'https://c.saavncdn.com/artists/Harris_Jayaraj_002_20230718071330_500x500.jpg' },
    { id: '458712', name: 'G.V. Prakash Kumar', imageUrl: 'https://c.saavncdn.com/artists/G_V_Prakash_Kumar_002_20210322080351_500x500.jpg' },
    { id: '455130', name: 'Ilaiyaraaja', imageUrl: 'https://c.saavncdn.com/artists/Ilaiyaraaja_002_20210322080127_500x500.jpg' },
    { id: '689580', name: 'Sid Sriram', imageUrl: 'https://c.saavncdn.com/artists/Sid_Sriram_003_20230104093817_500x500.jpg' },
  ],
  Kannada: [
    { id: '458892', name: 'Arjun Janya', imageUrl: 'https://c.saavncdn.com/artists/Arjun_Janya_002_20201029112228_500x500.jpg' },
    { id: '458902', name: 'Raghu Dixit', imageUrl: 'https://c.saavncdn.com/artists/Raghu_Dixit_002_20201029112239_500x500.jpg' },
    { id: '158226197', name: 'Charan Raj', imageUrl: 'https://c.saavncdn.com/editorial/Let_sPlayCharanRaj_20240213112636_500x500.jpg' },
    { id: '455586', name: 'V. Harikrishna', imageUrl: 'https://c.saavncdn.com/artists/V_Harikrishna_002_20201029112028_500x500.jpg' },
    { id: '158226194', name: 'B. Ajaneesh Loknath', imageUrl: 'https://c.saavncdn.com/editorial/Let_sPlayB-AjaneeshLoknath_20240223124358_500x500.jpg' },
    { id: '468925', name: 'Ravi Basrur', imageUrl: 'https://c.saavncdn.com/artists/Ravi_Basrur_002_20210322080829_500x500.jpg' },
    { id: '694218', name: 'Sanjith Hegde', imageUrl: 'https://c.saavncdn.com/artists/Sanjith_Hegde_002_20210322081015_500x500.jpg' },
    { id: '455135', name: 'Vijay Prakash', imageUrl: 'https://c.saavncdn.com/artists/Vijay_Prakash_002_20201029112115_500x500.jpg' },
  ],
  Malayalam: [
    { id: '458789', name: 'Gopi Sundar', imageUrl: 'https://c.saavncdn.com/artists/Gopi_Sundar_002_20201029112445_500x500.jpg' },
    { id: '458895', name: 'Shaan Rahman', imageUrl: 'https://c.saavncdn.com/artists/Shaan_Rahman_002_20201029112512_500x500.jpg' },
    { id: '694825', name: 'Hesham Abdul Wahab', imageUrl: 'https://c.saavncdn.com/artists/Hesham_Abdul_Wahab_002_20220107085124_500x500.jpg' },
    { id: '695124', name: 'Sushin Shyam', imageUrl: 'https://c.saavncdn.com/artists/Sushin_Shyam_002_20220315091244_500x500.jpg' },
    { id: '458792', name: 'Deepak Dev', imageUrl: 'https://c.saavncdn.com/artists/Deepak_Dev_002_20201029112458_500x500.jpg' },
    { id: '458901', name: 'Rex Vijayan', imageUrl: 'https://c.saavncdn.com/artists/Rex_Vijayan_002_20201029112530_500x500.jpg' },
  ],
  Punjabi: [
    { id: '459312', name: 'Diljit Dosanjh', imageUrl: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221004163934_500x500.jpg' },
    { id: '691245', name: 'Sidhu Moose Wala', imageUrl: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20220601072915_500x500.jpg' },
    { id: '695842', name: 'AP Dhillon', imageUrl: 'https://c.saavncdn.com/artists/AP_Dhillon_002_20211119075429_500x500.jpg' },
    { id: '693158', name: 'Karan Aujla', imageUrl: 'https://c.saavncdn.com/artists/Karan_Aujla_003_20230821094825_500x500.jpg' },
    { id: '462145', name: 'Guru Randhawa', imageUrl: 'https://c.saavncdn.com/artists/Guru_Randhawa_003_20220406085125_500x500.jpg' },
    { id: '465892', name: 'B Praak', imageUrl: 'https://c.saavncdn.com/artists/B_Praak_002_20200810104112_500x500.jpg' },
  ],
  English: [
    { id: '459021', name: 'The Weeknd', imageUrl: 'https://c.saavncdn.com/artists/The_Weeknd_002_20200320101545_500x500.jpg' },
    { id: '459145', name: 'Taylor Swift', imageUrl: 'https://c.saavncdn.com/artists/Taylor_Swift_002_20221021081530_500x500.jpg' },
    { id: '458912', name: 'Ed Sheeran', imageUrl: 'https://c.saavncdn.com/artists/Ed_Sheeran_002_20210625074215_500x500.jpg' },
    { id: '691520', name: 'Dua Lipa', imageUrl: 'https://c.saavncdn.com/artists/Dua_Lipa_002_20200327091512_500x500.jpg' },
    { id: '692145', name: 'Billie Eilish', imageUrl: 'https://c.saavncdn.com/artists/Billie_Eilish_002_20210730081245_500x500.jpg' },
    { id: '458715', name: 'Drake', imageUrl: 'https://c.saavncdn.com/artists/Drake_002_20210903084512_500x500.jpg' },
  ]
};

export class HomeFeedGenerator {
  public static normalizeLanguage(lang: string | null | undefined): string {
    if (!lang) return 'Telugu';
    const clean = lang.trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  public static getArtistsForLanguage(lang: string, limit = 8): { id: string; name: string; imageUrl: string }[] {
    const normalized = this.normalizeLanguage(lang);
    
    // Check cached artists
    if (cachedArtists[normalized] && cachedArtists[normalized].length > 0) {
      return cachedArtists[normalized].slice(0, limit);
    }
    
    if (SEED_ARTISTS_BY_LANG[normalized]) {
      return SEED_ARTISTS_BY_LANG[normalized].slice(0, limit);
    }

    return SEED_ARTISTS_BY_LANG['Telugu'].slice(0, limit);
  }

  public static getHomeSectionsForLanguage(lang: string): HomeSection[] {
    const normalized = this.normalizeLanguage(lang);
    const data = dynamicPlaylists[normalized] || dynamicPlaylists['Telugu'] || {};

    const sections: HomeSection[] = [];

    // 1. Early Favorites / Quick Access
    if (data.quick_access && data.quick_access.length > 0) {
      sections.push({
        id: `early_favorites_${normalized}`,
        type: 'carousel',
        title: '🌱 Early Favorites for You',
        items: data.quick_access.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} • Curated`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: item.type || 'playlist'
        }))
      });
    }

    // 2. Superstar Hits
    if (data.superstars && data.superstars.length > 0) {
      sections.push({
        id: `superstars_${normalized}`,
        type: 'carousel',
        title: `🌟 ${normalized} Superstar Hits`,
        items: data.superstars.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} Cinema • Blockbuster Hits`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: 'playlist'
        }))
      });
    }

    // 3. Composer Spotlight
    if (data.composers && data.composers.length > 0) {
      sections.push({
        id: `composers_${normalized}`,
        type: 'carousel',
        title: `🎹 ${normalized} Composer Spotlight`,
        items: data.composers.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} • Maestro Discography`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: 'playlist'
        }))
      });
    }

    // 4. Top Voices & Legends
    if (data.singers && data.singers.length > 0) {
      sections.push({
        id: `singers_${normalized}`,
        type: 'carousel',
        title: `🎤 ${normalized} Top Voices & Legends`,
        items: data.singers.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} • Iconic Vocals`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: 'playlist'
        }))
      });
    }

    // 5. Decade Time Machine
    if (data.decades && data.decades.length > 0) {
      sections.push({
        id: `decades_${normalized}`,
        type: 'carousel',
        title: `⏳ ${normalized} Decade Time Machine`,
        items: data.decades.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} Nostalgia & Golden Hits`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: 'playlist'
        }))
      });
    }

    // 6. Playlists & Moods
    if (data.genres && data.genres.length > 0) {
      sections.push({
        id: `genres_${normalized}`,
        type: 'carousel',
        title: `🎧 ${normalized} Playlists`,
        items: data.genres.map((item: any) => ({
          id: item.id,
          title: item.title,
          subtitle: `${normalized} • Handcrafted Moods`,
          imageUrl: item.imageUrl || '/app-icon.png',
          type: 'playlist'
        }))
      });
    }

    return sections;
  }
}
