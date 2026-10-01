import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ songs: [] });
  }

  try {
    const songs = await musicService.getRadio(videoId);
    return NextResponse.json({ songs });
  } catch (error) {
    console.error("API /api/music/radio error:", error);
    return NextResponse.json({ songs: [] }, { status: 500 });
  }
}
