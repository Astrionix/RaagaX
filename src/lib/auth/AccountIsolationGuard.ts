/**
 * RaagaX Account Isolation Guard & Diagnostic Logger
 * 
 * Enforces strict user-level isolation across Authentication, Zustand stores,
 * client caches, IndexedDB, and realtime subscriptions.
 *
 * Invariants:
 * 1. NEVER apply or persist user-owned data belonging to a previous account.
 * 2. In-flight async responses from older auth sessions are discarded via monotonic authGeneration.
 * 3. Realtime event payloads are verified against activeUserId before mutating state.
 * 4. Diagnostics are logged using the structured format:
 *    [ACCOUNT_STATE] userId=... storeUserId=... sessionUserId=... source=... revision=...
 */

export class AccountIsolationGuard {
  private static instance: AccountIsolationGuard;

  private activeUserId: string | null = null;
  private authGeneration: number = 1;
  private isGuestSession: boolean = true;

  private constructor() {}

  public static getInstance(): AccountIsolationGuard {
    if (!AccountIsolationGuard.instance) {
      AccountIsolationGuard.instance = new AccountIsolationGuard();
    }
    return AccountIsolationGuard.instance;
  }

  /**
   * Returns current active authenticated userId
   */
  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  /**
   * Returns monotonic auth generation counter
   */
  public getAuthGeneration(): number {
    return this.authGeneration;
  }

  /**
   * Indicates if current session is an unauthenticated guest session
   */
  public getIsGuestSession(): boolean {
    return this.isGuestSession;
  }

  /**
   * Sets new authenticated user, incrementing authGeneration to invalidate pending requests
   */
  public setAuthenticatedUser(userId: string | null, source: string = 'AUTH_LOGIN') {
    if (this.activeUserId !== userId) {
      this.authGeneration += 1;
      const prevUser = this.activeUserId;
      this.activeUserId = userId;
      this.isGuestSession = !userId;

      this.logAccountState({
        userId: userId || 'anonymous',
        storeUserId: userId || 'guest',
        sessionUserId: userId || 'none',
        cacheUserId: userId || 'guest',
        source: `${source}_SWITCH_FROM_${prevUser || 'none'}`,
        revision: this.authGeneration,
      });
    }
  }

  /**
   * Clears authenticated user on logout, incrementing authGeneration to invalidate pending requests
   */
  public clearAuthenticatedUser(source: string = 'AUTH_LOGOUT') {
    this.authGeneration += 1;
    const prevUser = this.activeUserId;
    this.activeUserId = null;
    this.isGuestSession = true;

    this.logAccountState({
      userId: 'anonymous',
      storeUserId: 'guest',
      sessionUserId: 'none',
      cacheUserId: 'guest',
      source: `${source}_PREV_${prevUser || 'none'}`,
      revision: this.authGeneration,
    });
  }

  /**
   * Checks whether a given generation and targetUserId match the currently active auth session.
   * If false, any async callback or event must be discarded immediately.
   */
  public isCurrentAuthGeneration(gen: number, expectedUserId?: string | null): boolean {
    if (this.authGeneration !== gen) {
      return false;
    }
    if (expectedUserId !== undefined && expectedUserId !== this.activeUserId) {
      return false;
    }
    return true;
  }

  /**
   * Asserts account ownership before mutating local state or caching data.
   * Returns false if targetUserId does not belong to the current authenticated user.
   */
  public assertAccountIsolation(
    targetUserId: string | null | undefined,
    context: string,
    generation?: number,
    revision?: number
  ): boolean {
    // Generation check
    if (typeof generation === 'number' && generation !== this.authGeneration) {
      console.warn(`[ACCOUNT_ISOLATION_REJECTED] Stale auth generation (expected ${this.authGeneration}, received ${generation}) in context: ${context}`);
      return false;
    }

    // User ID matching
    const current = this.activeUserId;
    const isMatch = (targetUserId === current) || (!targetUserId && !current);

    this.logAccountState({
      userId: targetUserId || 'anonymous',
      storeUserId: current || 'guest',
      sessionUserId: current || 'none',
      cacheUserId: targetUserId || 'guest',
      source: isMatch ? context : `${context}_MISMATCH`,
      revision: revision || this.authGeneration,
    });

    if (!isMatch) {
      console.warn(`[ACCOUNT_ISOLATION_VIOLATION] Discarding state update: targetUserId (${targetUserId || 'none'}) !== activeUserId (${current || 'none'}) in context: ${context}`);
      return false;
    }

    return true;
  }

  /**
   * Standardized structured diagnostic logger
   * Never logs tokens, passwords, or sensitive credentials.
   */
  public logAccountState(params: {
    userId: string;
    storeUserId: string;
    sessionUserId: string;
    cacheUserId?: string;
    source: string;
    revision?: number;
  }) {
    console.log(
      `\n[ACCOUNT_STATE]\nuserId=${params.userId}\nstoreUserId=${params.storeUserId}\nsessionUserId=${params.sessionUserId}\ncacheUserId=${params.cacheUserId || params.userId}\nsource=${params.source}\nrevision=${params.revision ?? this.authGeneration}\n`
    );
  }

  /**
   * Reset helper for testing environments
   */
  public resetForTesting(userId: string | null = null) {
    this.activeUserId = userId;
    this.authGeneration = 1;
    this.isGuestSession = !userId;
  }
}
