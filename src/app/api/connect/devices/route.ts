import { NextRequest, NextResponse } from 'next/server';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';

export const dynamic = 'force-dynamic';

/**
 * GET /api/connect/devices?excludeId=...
 * Fetch all available online RaagaX devices on the network or account
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('excludeId') || undefined;
    const accountId = searchParams.get('accountId') || undefined;

    const forwardedFor = request.headers.get('cf-connecting-ip') ||
                         request.headers.get('x-forwarded-for') ||
                         request.headers.get('x-real-ip') || '';
    let clientIp = forwardedFor.split(',')[0].trim() || '127.0.0.1';
    if (clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');
    if (clientIp === '::1' || clientIp === 'localhost') clientIp = '127.0.0.1';
    const subnet = clientIp.includes('.') ? clientIp.split('.').slice(0, 3).join('.') : '127.0.0';

    const devices = ConnectDeviceRegistry.getActiveDevices(excludeId, subnet, accountId);

    return NextResponse.json({
      success: true,
      devices,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to list devices' }, { status: 500 });
  }
}
