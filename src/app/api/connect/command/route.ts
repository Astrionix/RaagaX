import { NextRequest, NextResponse } from 'next/server';
import { ConnectDeviceRegistry } from '@/lib/connect/ConnectDeviceRegistry';
import { ConnectCommand } from '@/types/connect';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connect/command
 * Send a remote playback RPC command to a target device
 */
export async function POST(request: NextRequest) {
  try {
    const command: ConnectCommand = await request.json();

    if (!command || !command.targetDeviceId || !command.action) {
      return NextResponse.json({ success: false, error: 'Invalid command payload' }, { status: 400 });
    }

    ConnectDeviceRegistry.queueCommand(command);

    return NextResponse.json({
      success: true,
      commandId: command.commandId,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[API /api/connect/command ERROR]', error);
    return NextResponse.json({ success: false, error: error?.message || 'Command dispatch failed' }, { status: 500 });
  }
}
