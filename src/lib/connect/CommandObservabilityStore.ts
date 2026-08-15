/**
 * CommandObservabilityStore — ring buffer of the last 100 command pipeline events.
 *
 * Records the full lifecycle of every command:
 *   sentAt → receivedAt → executedAt → ackAt
 *
 * Hidden from normal users. Exposed via the developer DiagnosticsPanel
 * (accessible at ?diagnostics=1).
 *
 * Usage:
 *   CommandObservabilityStore.getInstance().record({ commandId, type, ... })
 *   CommandObservabilityStore.getInstance().resolve(commandId, { ackAt, result })
 */

import { ConnectCommandType, CommandClass, COMMAND_CLASS_MAP, TransportMode, CommandAckStatus } from './types';

export interface CommandTrace {
  commandId: string;
  type: ConnectCommandType;
  class: CommandClass;
  sourceDeviceId: string;
  targetDeviceId?: string;
  transport: TransportMode | 'UNKNOWN';
  sentAt: number;
  receivedAt?: number;
  executedAt?: number;
  ackAt?: number;
  latencyMs?: number;        // sentAt → ackAt
  result: CommandAckStatus | 'PENDING' | 'DROPPED';
}

const MAX_TRACES = 100;

export class CommandObservabilityStore {
  private static instance: CommandObservabilityStore;
  private traces: CommandTrace[] = [];

  private constructor() {}

  public static getInstance(): CommandObservabilityStore {
    if (!CommandObservabilityStore.instance) {
      CommandObservabilityStore.instance = new CommandObservabilityStore();
    }
    return CommandObservabilityStore.instance;
  }

  /** Record a new outgoing command. */
  public record(params: Omit<CommandTrace, 'class' | 'result'> & { result?: CommandTrace['result'] }) {
    const trace: CommandTrace = {
      ...params,
      class: COMMAND_CLASS_MAP[params.type] ?? 'INTERACTIVE',
      result: params.result ?? 'PENDING',
    };

    this.traces.push(trace);
    if (this.traces.length > MAX_TRACES) {
      this.traces.shift();
    }
  }

  /** Update an existing trace with ACK/result data. */
  public resolve(commandId: string, update: Partial<Pick<CommandTrace, 'ackAt' | 'executedAt' | 'receivedAt' | 'result'>>) {
    const trace = this.traces.find(t => t.commandId === commandId);
    if (!trace) return;
    Object.assign(trace, update);
    if (update.ackAt && trace.sentAt) {
      trace.latencyMs = update.ackAt - trace.sentAt;
    }
  }

  /** Returns all traces, newest first. */
  public getTraces(): CommandTrace[] {
    return [...this.traces].reverse();
  }

  /** Returns the last N traces. */
  public getLastN(n: number): CommandTrace[] {
    return this.traces.slice(-n).reverse();
  }

  /** Summary stats for the diagnostics panel. */
  public getSummary() {
    const resolved = this.traces.filter(t => t.latencyMs !== undefined);
    const avgLatency = resolved.length
      ? resolved.reduce((s, t) => s + (t.latencyMs ?? 0), 0) / resolved.length
      : 0;
    const successRate = resolved.length
      ? resolved.filter(t => t.result === 'APPLIED').length / resolved.length
      : 1;

    return {
      totalCommands: this.traces.length,
      avgLatencyMs: Math.round(avgLatency),
      successRate: Math.round(successRate * 100),
      lastCommand: this.traces[this.traces.length - 1] ?? null,
    };
  }

  public reset() {
    this.traces = [];
  }
}
