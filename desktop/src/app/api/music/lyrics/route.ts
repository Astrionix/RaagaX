import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "";
  const artist = searchParams.get("artist") || "";
  const duration = parseInt(searchParams.get("duration") || "0", 10);
  const videoId = searchParams.get("videoId") || undefined;
  const album = searchParams.get("album") || undefined;
  const provider = searchParams.get("provider") || undefined;

  if (!title) {
    return NextResponse.json({ synced: false, lines: [] });
  }

  try {
    const data = await musicService.getLyrics(title, artist, duration, videoId, album, provider);
    return NextResponse.json(data);
  } catch (error) {
    console.error("API /api/music/lyrics error:", error);
    return NextResponse.json({ synced: false, lines: [] }, { status: 500 });
  }
}
