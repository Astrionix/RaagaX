import { NextRequest, NextResponse } from "next/server";
import { musicService } from "@/services/music";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing album ID" }, { status: 400 });
  }

  try {
    const data = await musicService.getDetail(id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("API /api/music/album error:", error);
    return NextResponse.json({ error: "Failed to fetch album" }, { status: 500 });
  }
}
