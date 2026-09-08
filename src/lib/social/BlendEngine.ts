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
  public static getUniqueBlendId(seed?: string): string {
    if (!seed) {
      const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
      return `RGX-${randomHex}`;
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash).toString(16).substring(0, 4).toUpperCase();
    return `RGX-${positiveHash}`;
  }

  public static parseBlendInput(input: string): { friendName: string; friendId: string; isUniqueId: boolean } {
    const trimmed = input.trim();
    if (trimmed.toUpperCase().startsWith('RGX-') || trimmed.length === 8) {
      return {
        friendName: `User ${trimmed.toUpperCase()}`,
        friendId: trimmed.toUpperCase(),
        isUniqueId: true,
      };
    }
    return {
      friendName: trimmed,
      friendId: this.getUniqueBlendId(trimmed),
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
