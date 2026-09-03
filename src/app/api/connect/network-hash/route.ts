import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * GET /api/connect/network-hash
 *
 * Provides a shared network hash for all clients connecting through the same Wi-Fi router / NAT.
 * Used by RaagaX Connect to join a common local mesh presence channel (`devices_lan_${networkHash}`).
 */
export async function GET(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get('cf-connecting-ip') ||
                         request.headers.get('x-forwarded-for') ||
                         request.headers.get('x-real-ip') || '';

    let clientIp = forwardedFor.split(',')[0].trim() || '127.0.0.1';
    if (clientIp.startsWith('::ffff:')) clientIp = clientIp.replace('::ffff:', '');
    const { searchParams } = new URL(request.url);
    const localSubnetParam = searchParams.get('localSubnet') || '';

    const rawToHash = localSubnetParam ? `${clientIp}_${localSubnetParam}` : clientIp;
    const networkHash = simpleHash(rawToHash);
    const subnet = clientIp.includes('.') ? clientIp.split('.').slice(0, 3).join('.') : '127.0.0';

    return NextResponse.json({
      success: true,
      networkHash,
      subnet,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      networkHash: 'local_mesh',
      subnet: '127.0.0',
    });
  }
}
