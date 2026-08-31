import { NextRequest, NextResponse } from 'next/server';
import { PairingManager } from '@/lib/connect/authorization/PairingManager';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connect/pair
 * Actions: 'REQUEST', 'APPROVE', 'DENY', 'CHECK'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, controllerDeviceId, controllerDeviceName, targetDeviceId, code } = body;

    const manager = PairingManager.getInstance();

    if (action === 'REQUEST') {
      const req = manager.requestPairing(controllerDeviceId, controllerDeviceName || 'Guest Device', targetDeviceId, code);
      return NextResponse.json({ success: true, pairingRequest: req });
    }

    if (action === 'APPROVE') {
      manager.approvePairing(controllerDeviceId, targetDeviceId);
      return NextResponse.json({ success: true, isPaired: true });
    }

    if (action === 'DENY') {
      manager.denyPairing(controllerDeviceId, targetDeviceId);
      return NextResponse.json({ success: true, isPaired: false });
    }

    if (action === 'CHECK') {
      const isPaired = manager.isPaired(controllerDeviceId, targetDeviceId);
      const pending = manager.getPendingRequestsForTarget(targetDeviceId);
      return NextResponse.json({ success: true, isPaired, pendingRequests: pending });
    }

    return NextResponse.json({ success: false, error: 'Invalid pairing action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Pairing error' }, { status: 500 });
  }
}
