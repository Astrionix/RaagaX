import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";
import { SearchFilter } from "@/types/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const filter = (searchParams.get("filter") || "All") as SearchFilter;

  if (!query) {
    return NextResponse.json({ songs: [], albums: [], artists: [], playlists: [], videos: [] });
  }

  try {
    const results = await musicService.search(query, filter);
    return NextResponse.json(results);
  } catch (error) {
    console.error("API /api/music/search error:", error);
    return NextResponse.json({ songs: [], albums: [], artists: [], playlists: [], videos: [] }, { status: 500 });
  }
}
