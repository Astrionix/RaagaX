import { NextResponse } from 'next/server';
import { ArtistDiscoveryEngine } from '@/lib/discovery/ArtistDiscoveryEngine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'Hindi';
    const limitParam = searchParams.get('limit') || '8';
    const limit = parseInt(limitParam) || 8;

    const engine = ArtistDiscoveryEngine.getInstance();
    
    // Attempt to fetch artists for the requested language
    // Note: To avoid blocking the page load, we should ideally fetch this quickly if cached
    const artists = await engine.getArtistsForLanguage(lang, limit);

    return NextResponse.json({
      success: true,
      data: artists
    });
  } catch (error: any) {
    console.error('Error fetching artists API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch artists' },
      { status: 500 }
    );
  }
}
