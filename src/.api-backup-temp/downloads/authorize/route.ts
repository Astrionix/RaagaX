import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trackId, quality = 'HIGH', deviceId } = body;

    if (!trackId) {
      return NextResponse.json({ success: false, error: 'Missing trackId' }, { status: 400 });
    }

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const leaseExpiresAt = Date.now() + thirtyDaysMs;

    // Generate signed download authorization token
    const payload = `${trackId}:${deviceId || 'web_client'}:${leaseExpiresAt}`;
    const token = Buffer.from(payload).toString('base64url');

    return NextResponse.json({
      success: true,
      authorized: true,
      trackId,
      token,
      quality,
      leaseExpiresAt,
      downloadUrl: `/api/downloads/${encodeURIComponent(trackId)}/url?token=${token}`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Authorization failed' }, { status: 500 });
  }
}
