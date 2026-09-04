import { ConnectCommand, ConnectCommandType, CommandAck } from './types';
import { TransportManager } from './TransportManager';
import { DeviceIdentityManager } from './DeviceIdentityManager';

export class CommandManager {
  private static instance: CommandManager;
  private pendingCommands: Map<string, { resolve: (ack: CommandAck) => void; reject: (err: any) => void; timer: any }> = new Map();
  private processedCommandIds: Set<string> = new Set();
  private commandExecutionHandler: ((cmd: ConnectCommand) => Promise<CommandAck>) | null = null;

  private constructor() {
    this.bindTransport();
  }

  public static getInstance(): CommandManager {
    if (!CommandManager.instance) {
      CommandManager.instance = new CommandManager();
    }
    return CommandManager.instance;
  }

  private bindTransport(): void {
    const transport = TransportManager.getInstance();
    transport.onMessage((event, payload) => {
      if (event === 'CONNECT_COMMAND') {
        this.handleIncomingCommand(payload as ConnectCommand);
      } else if (event === 'COMMAND_ACK') {
        this.handleIncomingAck(payload as CommandAck);
      }
    });
  }

  // 1. Controller dispatches command to Player
  public async sendCommand(
    connectionId: string,
    playerDeviceId: string,
    commandType: ConnectCommandType,
    payload?: any,
    timeoutMs: number = 6000
  ): Promise<CommandAck> {
    const self = DeviceIdentityManager.getInstance().getDevice();
    const commandId = 'cmd_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 10) : Math.random().toString(36).slice(2, 10));

    const command: ConnectCommand = {
      commandId,
      connectionId,
      controllerDeviceId: self.deviceId,
      playerDeviceId,
      commandType,
      payload,
      timestamp: Date.now(),
      stateVersion: 0,
    };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        // Optimistically resolve if ACK was delayed on mesh / cloud relay
        resolve({ commandId, status: 'accepted' });
      }, timeoutMs || 6000);

      this.pendingCommands.set(commandId, { resolve, reject: () => {}, timer });
      TransportManager.getInstance().sendMessage('CONNECT_COMMAND', command, playerDeviceId);
    });
  }

  // 2. Player receives and executes command, then replies with ACK
  private async handleIncomingCommand(command: ConnectCommand): Promise<void> {
    if (command.controllerDeviceId) {
      TransportManager.getInstance().setTargetDeviceId(command.controllerDeviceId);
    }

    // Deduplication check: ignore if already executed
    if (this.processedCommandIds.has(command.commandId)) {
      return;
    }
    this.processedCommandIds.add(command.commandId);
    if (this.processedCommandIds.size > 200) {
      const first = this.processedCommandIds.values().next().value;
      if (first) this.processedCommandIds.delete(first);
    }

    let ack: CommandAck;
    if (this.commandExecutionHandler) {
      try {
        ack = await this.commandExecutionHandler(command);
      } catch (err: any) {
        ack = { commandId: command.commandId, status: 'rejected', reason: err?.message || 'Execution error' };
      }
    } else {
      ack = { commandId: command.commandId, status: 'unsupported', reason: 'No player execution handler mounted' };
    }

    TransportManager.getInstance().sendMessage('COMMAND_ACK', ack, command.controllerDeviceId);
  }

  // 3. Controller receives ACK for pending command
  private handleIncomingAck(ack: CommandAck): void {
    const pending = this.pendingCommands.get(ack.commandId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCommands.delete(ack.commandId);
      if (ack.status === 'accepted') {
        pending.resolve(ack);
      } else {
        pending.reject(new Error(ack.reason || `Command rejected with status ${ack.status}`));
      }
    }
  }

  public setCommandExecutionHandler(handler: (cmd: ConnectCommand) => Promise<CommandAck>): void {
    this.commandExecutionHandler = handler;
  }
}
