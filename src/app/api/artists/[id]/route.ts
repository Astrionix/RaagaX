import { NextResponse } from 'next/server';
import { ArtistDiscoveryEngine } from '@/lib/discovery/ArtistDiscoveryEngine';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Artist ID required' }, { status: 400 });
    }

    const engine = ArtistDiscoveryEngine.getInstance();
    const artistDetails = await engine.getArtistById(id);

    if (!artistDetails) {
      return NextResponse.json({ success: false, error: 'Artist not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: artistDetails
    });
  } catch (error: any) {
    console.error('Error fetching artist details API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch artist details' },
      { status: 500 }
    );
  }
}
