/**
 * RaagaX Connect — Command Deduplicator
 *
 * Enforces command idempotency. Caches processed command/request IDs
 * to prevent duplicate execution from network retries.
 */

export class CommandDeduplicator {
  private static instance: CommandDeduplicator;
  private processedIds: Map<string, { revision: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60000; // 60 seconds

  private constructor() {}

  public static getInstance(): CommandDeduplicator {
    if (!CommandDeduplicator.instance) {
      CommandDeduplicator.instance = new CommandDeduplicator();
    }
    return CommandDeduplicator.instance;
  }

  public isDuplicate(requestId: string): boolean {
    if (!requestId) return false;
    this.pruneExpired();
    return this.processedIds.has(requestId);
  }

  public recordProcessed(requestId: string, revision: number): void {
    if (!requestId) return;
    this.processedIds.set(requestId, {
      revision,
      timestamp: Date.now(),
    });
  }

  public getCachedRevision(requestId: string): number | undefined {
    return this.processedIds.get(requestId)?.revision;
  }

  private pruneExpired(): void {
    const now = Date.now();
    this.processedIds.forEach((entry, key) => {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.processedIds.delete(key);
      }
    });
  }
}
