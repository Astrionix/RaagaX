import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await musicService.getSuggestions(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("API /api/music/suggestions error:", error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
