import { Song } from '@/types/music';

export interface BlendResult {
  id: string;
  userA: string;
  userB: string;
  userAId: string;
  userBId: string;
  matchScore: number;
  description: string;
  playlistTitle: string;
  songs: Song[];
  coverGradient: string;
}

export class BlendEngine {
  public static generate4CharAlphanumeric(): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public static getUniqueBlendId(seed?: string): string {
    if (!seed) {
      return `RGX-${this.generate4CharAlphanumeric()}`;
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let posHash = Math.abs(hash);
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(posHash % chars.length);
      posHash = Math.floor(posHash / chars.length);
    }
    return `RGX-${code}`;
  }

  public static parseBlendInput(input: string): { friendName: string; friendId: string; isUniqueId: boolean } {
    const trimmed = input.trim().toUpperCase();
    // Support 4-character alphanumeric code (e.g. A8K2), RGX-A8K2, or 8-char codes
    const isTag = trimmed.startsWith('RGX-') || (trimmed.length === 4 && /^[A-Z0-9]{4}$/.test(trimmed)) || trimmed.length === 8;
    if (isTag) {
      const fullTag = trimmed.startsWith('RGX-') ? trimmed : (trimmed.length === 4 ? `RGX-${trimmed}` : trimmed);
      const codePart = fullTag.replace('RGX-', '');
      return {
        friendName: `Friend ${codePart}`,
        friendId: fullTag,
        isUniqueId: true,
      };
    }
    return {
      friendName: input.trim(),
      friendId: this.getUniqueBlendId(input.trim()),
      isUniqueId: false,
    };
  }

  public static createBlend(
    userAName: string,
    userAId: string,
    friendInput: string,
    userASongs: Song[],
    userBSongs: Song[]
  ): BlendResult {
    const parsedFriend = this.parseBlendInput(friendInput);
    const userBName = parsedFriend.friendName;
    const userBId = parsedFriend.friendId;

    const listA = userASongs.length > 0 ? userASongs : [];
    const listB = userBSongs.length > 0 ? userBSongs : [];

    // Calculate Jaccard similarity based on shared artists/genres
    const setA = new Set(listA.map(s => s.artist?.toLowerCase() || s.title?.toLowerCase()));
    const setB = new Set(listB.map(s => s.artist?.toLowerCase() || s.title?.toLowerCase()));

    let intersectionCount = 0;
    setA.forEach(item => {
      if (setB.has(item)) intersectionCount++;
    });

    const unionCount = Math.max(1, setA.size + setB.size - intersectionCount);
    const rawMatch = (intersectionCount / unionCount) * 100;
    
    // Scale match score nicely between 78% and 98% for great user experience
    const matchScore = Math.min(99, Math.max(78, Math.round(80 + rawMatch * 0.35)));

    // Interleave 50/50 songs from both users
    const blendedSongs: Song[] = [];
    const maxLen = Math.max(listA.length, listB.length, 10);
    const usedIds = new Set<string>();

    for (let i = 0; i < maxLen; i++) {
      if (listA[i] && !usedIds.has(listA[i].id)) {
        blendedSongs.push(listA[i]);
        usedIds.add(listA[i].id);
      }
      if (listB[i] && !usedIds.has(listB[i].id)) {
        blendedSongs.push(listB[i]);
        usedIds.add(listB[i].id);
      }
      if (blendedSongs.length >= 40) break;
    }

    // Fallback: If both users have empty liked songs, provide high-quality curated chartbusters
    if (blendedSongs.length < 5) {
      const fallbackTracks: Song[] = [
        {
          id: 'dev_chuttamalle',
          title: 'Chuttamalle',
          artist: 'Shilpa Rao, Anirudh Ravichander',
          artistId: '455663',
          album: 'Devara Part 1',
          albumId: 'devara_1',
          duration: 220,
          coverUrl: 'https://c.saavncdn.com/006/Devara-Part-1-Telugu-2024-20240927161008-500x500.jpg',
          audioUrl: null,
          genre: 'Melody',
          category: 'latest_telugu',
          releaseYear: 2024,
          plays: 12000000,
          likes: 450000,
        },
        {
          id: 'dev_fear_song',
          title: 'Fear Song',
          artist: 'Anirudh Ravichander',
          artistId: '455663',
          album: 'Devara Part 1',
          albumId: 'devara_1',
          duration: 195,
          coverUrl: 'https://c.saavncdn.com/006/Devara-Part-1-Telugu-2024-20240927161008-500x500.jpg',
          audioUrl: null,
          genre: 'Mass',
          category: 'mass',
          releaseYear: 2024,
          plays: 18000000,
          likes: 620000,
        },
        {
          id: 'push_srivalli',
          title: 'Srivalli',
          artist: 'Sid Sriram, Devi Sri Prasad',
          artistId: '689580',
          album: 'Pushpa - The Rise',
          albumId: 'pushpa_1',
          duration: 218,
          coverUrl: 'https://c.saavncdn.com/832/Pushpa-The-Rise-Telugu-2021-20211223201458-500x500.jpg',
          audioUrl: null,
          genre: 'Melody',
          category: 'latest_telugu',
          releaseYear: 2021,
          plays: 25000000,
          likes: 850000,
        },
        {
          id: 'ala_samajavaragamana',
          title: 'Samajavaragamana',
          artist: 'Sid Sriram, Thaman S',
          artistId: '689580',
          album: 'Ala Vaikunthapurramuloo',
          albumId: 'avpl_1',
          duration: 214,
          coverUrl: 'https://c.saavncdn.com/348/Ala-Vaikunthapurramuloo-Telugu-2019-20200113151128-500x500.jpg',
          audioUrl: null,
          genre: 'Melody',
          category: 'latest_telugu',
          releaseYear: 2020,
          plays: 35000000,
          likes: 1200000,
        },
        {
          id: 'rrr_naatu',
          title: 'Naatu Naatu',
          artist: 'Rahul Sipligunj, Kaala Bhairava, M.M. Keeravaani',
          artistId: '456269',
          album: 'RRR',
          albumId: 'rrr_1',
          duration: 215,
          coverUrl: 'https://c.saavncdn.com/581/RRR-Telugu-2021-20211210141008-500x500.jpg',
          audioUrl: null,
          genre: 'Mass Beats',
          category: 'mass',
          releaseYear: 2022,
          plays: 40000000,
          likes: 1500000,
        },
        {
          id: 'dev_daavudi',
          title: 'Daavudi',
          artist: 'Nakash Aziz, Akasa, Anirudh Ravichander',
          artistId: '455663',
          album: 'Devara Part 1',
          albumId: 'devara_1',
          duration: 205,
          coverUrl: 'https://c.saavncdn.com/006/Devara-Part-1-Telugu-2024-20240927161008-500x500.jpg',
          audioUrl: null,
          genre: 'Dance',
          category: 'mass',
          releaseYear: 2024,
          plays: 9000000,
          likes: 320000,
        }
      ];

      fallbackTracks.forEach((t) => {
        if (!usedIds.has(t.id)) {
          blendedSongs.push(t);
          usedIds.add(t.id);
        }
      });
    }

    const descriptions = [
      `Your music DNA overlaps on high-energy Telugu & Bollywood hits!`,
      `You both share a deep love for acoustic melodies & late-night tracks!`,
      `High vibe match! Perfect blend of trending chartbusters & classic favorites!`,
    ];

    const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];

    return {
      id: `blend-${Date.now()}`,
      userA: userAName,
      userB: userBName,
      userAId,
      userBId,
      matchScore,
      description: randomDesc,
      playlistTitle: `${userAName} + ${userBName}'s Blend`,
      songs: blendedSongs,
      coverGradient: 'from-[#FA233B] via-rose-600 to-indigo-900',
    };
  }
}
