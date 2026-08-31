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

    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const clientIp = forwardedFor.split(',')[0].trim() || '127.0.0.1';
    const subnet = clientIp.split('.').slice(0, 3).join('.');

    ConnectDeviceRegistry.registerBeacon(device, subnet, email);

    // Also check if there are any pending commands destined for this device
    const pendingCommands = ConnectDeviceRegistry.fetchAndDrainCommands(device.deviceId);

    return NextResponse.json({
      success: true,
      pendingCommands,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Beacon failed' }, { status: 500 });
  }
}
