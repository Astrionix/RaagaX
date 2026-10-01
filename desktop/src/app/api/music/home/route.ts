import { NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET() {
  try {
    const shelves = await musicService.getHome();
    return NextResponse.json({ shelves });
  } catch (error) {
    console.error("API /api/music/home error:", error);
    return NextResponse.json({ shelves: [] }, { status: 500 });
  }
}
