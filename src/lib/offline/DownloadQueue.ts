import { DownloadTask, DownloadStatus } from './types';

export class DownloadQueue {
  private static instance: DownloadQueue;
  private queue: DownloadTask[] = [];
  private activeDownloads: Set<string> = new Set();
  // No concurrent limit — all queued downloads run in parallel
  private listeners: Set<(queue: DownloadTask[]) => void> = new Set();

  public static getInstance(): DownloadQueue {
    if (!DownloadQueue.instance) {
      DownloadQueue.instance = new DownloadQueue();
    }
    return DownloadQueue.instance;
  }

  /** No-op kept for API compatibility — limit is removed. */
  public setMaxConcurrent(_max: number) {}

  public getTasks(): DownloadTask[] {
    return [...this.queue];
  }

  public getTask(taskId: string): DownloadTask | undefined {
    return this.queue.find((t) => t.id === taskId);
  }

  public getTaskByTrackId(trackId: string): DownloadTask | undefined {
    return this.queue.find((t) => t.trackId === trackId);
  }

  public addTask(task: DownloadTask) {
    const existing = this.getTask(task.id);
    if (existing) return;
    this.queue.push(task);
    this.notify();
  }

  public updateTask(taskId: string, updates: Partial<DownloadTask>) {
    const task = this.getTask(taskId);
    if (task) {
      Object.assign(task, updates, { updatedAt: Date.now() });
      this.notify();
    }
  }

  public removeTask(taskId: string) {
    this.queue = this.queue.filter((t) => t.id !== taskId);
    this.activeDownloads.delete(taskId);
    this.notify();
  }

  public getNextPendingTask(): DownloadTask | null {
    return this.queue.find((t) => t.status === 'queued') || null;
  }

  /** Always true — all downloads run in parallel with no concurrency cap. */
  public canStartNewDownload(): boolean {
    return true;
  }

  public markAsActive(taskId: string) {
    this.activeDownloads.add(taskId);
  }

  public markAsInactive(taskId: string) {
    this.activeDownloads.delete(taskId);
  }

  public subscribe(listener: (queue: DownloadTask[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.getTasks());
    }
  }
}
