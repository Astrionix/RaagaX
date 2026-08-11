import { ConnectCommand } from './types';
import { CommandValidator } from './CommandValidator';
import { ConnectManager } from './ConnectManager';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { ClockSynchronizer } from './ClockSynchronizer';
import { usePlayerStore } from '@/context/usePlayerStore';
import { TransferManager } from './TransferManager';

export class CommandBus {
  private static instance: CommandBus;
  private validator = CommandValidator.getInstance();
  private localDeviceId: string | null = null;
  private sessionId: string | null = null;

  private constructor() {}

  public static getInstance(): CommandBus {
    if (!CommandBus.instance) {
      CommandBus.instance = new CommandBus();
    }
    return CommandBus.instance;
  }

  public init(localDeviceId: string, sessionId: string) {
    this.localDeviceId = localDeviceId;
    this.sessionId = sessionId;
  }

  public async dispatch(command: ConnectCommand) {
    const connectManager = ConnectManager.getInstance();
    
    if (command.targetDeviceId) {
      await connectManager.sendTargetedCommand(command.targetDeviceId, command);
    } else {
      await connectManager.sendSessionCommand(command);
    }
  }

  public handleIncomingCommand(command: ConnectCommand) {
    if (!this.validator.validate(command)) return;

    this.applyCommand(command);
  }

  private applyCommand(command: ConnectCommand) {
    console.log(`[CommandBus] Applying command: ${command.type}`);
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();
    const clock = ClockSynchronizer.getInstance();

    switch (command.type) {
      case 'PLAY':
        if (command.payload && typeof command.payload === 'object' && 'positionMs' in command.payload && 'serverTimestamp' in command.payload) {
           const p = command.payload as { positionMs: number, serverTimestamp: number };
           const estimatedNow = clock.getEstimatedServerNow();
           const drift = estimatedNow - p.serverTimestamp;
           const targetMs = p.positionMs + Math.max(0, drift);
           engine.seekCanonical(targetMs);
        }
        engine.play();
        store.setIsPlaying(true);
        break;

      case 'PAUSE':
        engine.pause();
        store.setIsPlaying(false);
        break;

      case 'SEEK':
        if (command.payload && typeof command.payload === 'object' && 'positionMs' in command.payload) {
          const p = command.payload as { positionMs: number };
          engine.seekCanonical(p.positionMs);
        }
        break;
        
      case 'TRANSFER_REQUEST':
        if (command.targetDeviceId === this.localDeviceId) {
           console.log('[CommandBus] Received TRANSFER_REQUEST');
           TransferManager.getInstance().handleIncomingTransferRequest(command);
        }
        break;
        
      case 'COMMAND_ACK':
        console.log('[CommandBus] Received ACK:', command.payload);
        break;

      default:
        console.warn(`[CommandBus] Unhandled command type: ${command.type}`);
    }
  }
}
