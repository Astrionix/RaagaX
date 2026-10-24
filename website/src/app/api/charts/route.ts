import { NextResponse } from "next/server";
import { BEST_NEW_GROUPS, NEW_THIS_WEEK, RECENT_RELEASES } from "@/data/discoveryData";

export const revalidate = 86400; // Auto-revalidate daily

export interface SongEntry {
  title: string;
  artist: string;
  cover: string;
  explicit?: boolean;
}

export async function GET() {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    };

    // 1. Fetch Daily Global Top Tracks (50 songs)
    const topRes = await fetch(
      "https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/songs.json",
      { headers, next: { revalidate: 86400 } }
    );

    // 2. Fetch Daily Top Studio Albums & Master Releases (50 albums)
    const albumRes = await fetch(
      "https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/albums.json",
      { headers, next: { revalidate: 86400 } }
    );

    if (!topRes.ok) {
      throw new Error(`Failed to fetch top charts: ${topRes.statusText}`);
    }

    const topData = await topRes.json();
    const albumData = albumRes.ok ? await albumRes.json() : null;

    // Lossless studio cover replacement: delivers pure 1000x1000 HD artwork
    const formatCover = (url: string) => {
      if (!url) return "";
      return url.replace(/\/\d+x\d+bb\.jpg$/, "/1000x1000bb.jpg");
    };

    // Transform Top Songs into high-res entries
    const allTracks: SongEntry[] = (topData.feed?.results || []).map((item: any) => ({
      title: item.name || "Unknown Track",
      artist: item.artistName || "Unknown Artist",
      cover: formatCover(item.artworkUrl100),
      explicit: item.contentAdvisoryRating === "Explicit",
    }));

    // Group first 48 tracks into 12 columns of 4 songs each for the BitChord stacked carousel
    const bestNewGroups: SongEntry[][] = [];
    for (let i = 0; i < Math.min(48, allTracks.length); i += 4) {
      bestNewGroups.push(allTracks.slice(i, i + 4));
    }

    // New This Week: Fresh featured drops (take from tracks 10 to 35)
    const newThisWeek: SongEntry[] = allTracks.slice(12, 36);

    // Recent Releases: Studio Master Albums from album charts
    const recentReleases: SongEntry[] = (albumData?.feed?.results || []).slice(0, 24).map((item: any) => ({
      title: item.name || "Unknown Album",
      artist: item.artistName || "Unknown Artist",
      cover: formatCover(item.artworkUrl100),
      explicit: item.contentAdvisoryRating === "Explicit",
    }));

    return NextResponse.json({
      success: true,
      source: "apple_music_rss_lossless_hd",
      updatedAt: new Date().toISOString(),
      bestNewGroups: bestNewGroups.length > 0 ? bestNewGroups : BEST_NEW_GROUPS,
      newThisWeek: newThisWeek.length > 0 ? newThisWeek : NEW_THIS_WEEK,
      recentReleases: recentReleases.length > 0 ? recentReleases : RECENT_RELEASES,
    });
  } catch (error: any) {
    console.error("Daily charts fallback triggered:", error.message);
    return NextResponse.json({
      success: true,
      source: "curated_catalog_fallback",
      updatedAt: new Date().toISOString(),
      bestNewGroups: BEST_NEW_GROUPS,
      newThisWeek: NEW_THIS_WEEK,
      recentReleases: RECENT_RELEASES,
    });
  }
}
