import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const songId = searchParams.get("songId");

  if (!songId) {
    return NextResponse.json({ url: "", kbps: 160 }, { status: 400 });
  }

  try {
    const stream = await musicService.getStream({
      videoId: songId,
      title: "",
      artist: "",
      thumbnailUrl: "",
    });
    return NextResponse.json(stream);
  } catch (error) {
    console.error("API /api/music/stream error:", error);
    return NextResponse.json({ url: "", kbps: 160 }, { status: 500 });
  }
}
