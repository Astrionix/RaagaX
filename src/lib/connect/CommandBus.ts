import { PlaybackCommand, CommandValidator } from './CommandValidator';
import { ConnectManager } from './ConnectManager';
import { PlaybackEngine } from '../playback/PlaybackEngine';
import { HandoffManager } from '../playback/HandoffManager';
import { usePlayerStore } from '@/context/usePlayerStore';

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

  public async dispatch(command: PlaybackCommand) {
    // Send via ConnectManager to either target device or session channel
    const connectManager = ConnectManager.getInstance();
    
    if (command.targetDeviceId) {
      await connectManager.sendTargetedCommand(command.targetDeviceId, command);
    } else {
      await connectManager.sendSessionCommand(command);
    }
  }

  public handleIncomingCommand(command: PlaybackCommand) {
    const validationResult = this.validator.validate(command);

    if (validationResult === 'DROP') return;

    if (validationResult === 'RECONCILE') {
      console.log('[CommandBus] Triggering session reconcile');
      // Trigger durable recovery fetch
      // This would hook into PlaybackSessionManager to fetch from Postgres
      return;
    }

    if (validationResult === 'APPLY') {
      this.applyCommand(command);
      this.validator.markProcessed(command.commandId, command.epoch, command.sequence);
    }
  }

  private applyCommand(command: PlaybackCommand) {
    console.log(`[CommandBus] Applying command: ${command.type}`);
    const engine = PlaybackEngine.getInstance();
    const store = usePlayerStore.getState();

    switch (command.type) {
      case 'PLAY':
        if (command.canonicalPositionMs !== undefined) {
          engine.seekCanonical(command.canonicalPositionMs);
        }
        engine.play();
        store.setIsPlaying(true);
        break;

      case 'PAUSE':
        engine.pause();
        store.setIsPlaying(false);
        break;

      case 'SEEK':
        if (command.canonicalPositionMs !== undefined) {
          engine.seekCanonical(command.canonicalPositionMs);
        }
        break;
        
      case 'TRANSFER':
      case 'HANDOFF':
        // If this device is the target, initiate the receive process
        if (command.targetDeviceId === this.localDeviceId) {
           console.log('[CommandBus] We are the target of a handoff. Connecting...');
           // Typically this initiates playback preparation 
           // and potentially an ACK back to sender.
           // HandoffManager handles same-device, Connect protocol handles cross-device.
        }
        break;
        
      default:
        console.warn(`[CommandBus] Unhandled command type: ${command.type}`);
    }
  }
}
