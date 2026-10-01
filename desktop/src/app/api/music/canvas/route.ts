import { NextRequest, NextResponse } from "next/server";
import { fetchCanvas } from "@/services/music/canvas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title");
    const artist = searchParams.get("artist") || "";
    const album = searchParams.get("album") || undefined;

    if (!title) {
      return NextResponse.json(
        { error: "Title parameter is required" },
        { status: 400 }
      );
    }

    const data = await fetchCanvas(title, artist, album);
    return NextResponse.json(data);
  } catch (err) {
    console.error("API /api/music/canvas error:", err);
    return NextResponse.json({ canvasUrl: null, source: null }, { status: 500 });
  }
}
