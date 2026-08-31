/**
 * RaagaX Connect — Revision & Generation Manager
 *
 * Manages monotonic state revisions and generation numbers for track invalidation.
 */

export class RevisionManager {
  private revision: number = 1;
  private generation: number = 1;

  public getRevision(): number {
    return this.revision;
  }

  public getGeneration(): number {
    return this.generation;
  }

  public nextRevision(): number {
    this.revision += 1;
    return this.revision;
  }

  public nextGeneration(): number {
    this.generation += 1;
    this.revision += 1;
    return this.generation;
  }

  public reset(revision: number = 1, generation: number = 1): void {
    this.revision = revision;
    this.generation = generation;
  }
}
