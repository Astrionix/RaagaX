import { Song } from '@/types/music';

export interface BlendResult {
  id: string;
  userA: string;
  userB: string;
  matchScore: number;
  description: string;
  playlistTitle: string;
  songs: Song[];
  coverGradient: string;
}

export class BlendEngine {
  public static createBlend(
    userAName: string,
    userBName: string,
    userASongs: Song[],
    userBSongs: Song[]
  ): BlendResult {
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
    const matchScore = Math.min(99, Math.max(76, Math.round(78 + rawMatch * 0.4)));

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
      matchScore,
      description: randomDesc,
      playlistTitle: `${userAName} + ${userBName}'s Blend`,
      songs: blendedSongs,
      coverGradient: 'from-[#FA233B] via-rose-600 to-indigo-900',
    };
  }
}
