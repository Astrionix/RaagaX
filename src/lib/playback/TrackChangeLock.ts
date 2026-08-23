/**
 * TrackChangeLock — Singleton that tracks whether the client recently triggered
 * an optimistic track switch. Used to shield the controller's UI state from
 * being reverted by stale remote state broadcasts before the active device
 * finishes loading the new track.
 */

let _lockedTrackId: string | null = null;
let _lockUntil = 0;

export const TrackChangeLock = {
  lock(trackId: string, durationMs = 3500) {
    console.log(`[TrackChangeLock] Locking track target: ${trackId} for ${durationMs}ms`);
    _lockedTrackId = trackId;
    _lockUntil = Date.now() + durationMs;
  },

  unlock() {
    if (_lockedTrackId) {
      console.log(`[TrackChangeLock] Explicitly unlocked target: ${_lockedTrackId}`);
    }
    _lockedTrackId = null;
    _lockUntil = 0;
  },

  get lockedTrackId(): string | null {
    return _lockedTrackId;
  },

  isLocked(remoteTrackId: string | null | undefined): boolean {
    if (!_lockedTrackId || Date.now() > _lockUntil) {
      return false;
    }
    // If the remote active device has not transitioned to our optimistically selected track, lock is active
    return remoteTrackId !== _lockedTrackId;
  }
};
