import { NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET() {
  try {
    const data = await musicService.getExplore();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API /api/music/explore error:", error);
    return NextResponse.json({ newReleases: [], charts: [], exploreShelves: [], moodGenres: [] }, { status: 500 });
  }
}
