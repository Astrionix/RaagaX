import { NextRequest, NextResponse } from 'next/server';
import { JamServerEngine } from '@/lib/jam/server/JamServerEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jam/discover
 * Retrieves active nearby / subnet discoverable Jam parties
 */
export async function GET(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const clientIp = forwardedFor.split(',')[0].trim() || '127.0.0.1';
    
    // Extract subnet (e.g. 192.168.1.x)
    const subnet = clientIp.split('.').slice(0, 3).join('.');

    const engine = JamServerEngine.getInstance();
    const discovered = engine.getDiscoverableJams(subnet);

    return NextResponse.json({
      success: true,
      jams: discovered,
      clientSubnet: subnet,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[API /api/jam/discover] Error querying discoverable Jams:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to discover nearby Jams' },
      { status: 500 }
    );
  }
}
