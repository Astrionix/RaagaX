import { NextRequest, NextResponse } from 'next/server';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connect/beacon
 * Heartbeat registration from any active RaagaX device on LAN or Cloud
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const device = body.device || body;
    const email = body.email;
    const accountId = body.accountId;

    if (!device || !device.deviceId) {
      return NextResponse.json({ success: false, error: 'Missing device payload' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('cf-connecting-ip') ||
                         request.headers.get('x-forwarded-for') ||
                         request.headers.get('x-real-ip') || '';
    let clientIp = forwardedFor.split(',')[0].trim() || '127.0.0.1';
    if (clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');
    if (clientIp === '::1' || clientIp === 'localhost') clientIp = '127.0.0.1';
    const subnet = clientIp.includes('.') ? clientIp.split('.').slice(0, 3).join('.') : '127.0.0';

    ConnectDeviceRegistry.registerBeacon(device, subnet, email);

    // Also check if there are any pending commands destined for this device
    const pendingCommands = ConnectDeviceRegistry.fetchAndDrainCommands(device.deviceId);

    return NextResponse.json({
      success: true,
      clientIp,
      subnet,
      pendingCommands,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Beacon failed' }, { status: 500 });
  }
}
