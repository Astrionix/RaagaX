/**
 * SeekLock — shared singleton that tracks whether the user is actively
 * dragging a seekbar. Used to suppress remote position updates during seek
 * and for a brief settling window afterward.
 *
 * This is intentionally a plain module-level singleton (not Zustand) to
 * avoid triggering React re-renders when just checking the flag.
 */

let _isSeeking = false;
let _settleUntil = 0;        // timestamp (ms) — ignore remote updates until this time
let _seekRevision = 0;       // monotonically increasing, incremented on every SEEK dispatch

export const SeekLock = {
  startSeeking() {
    _isSeeking = true;
  },

  endSeeking(settleMs = 300) {
    _isSeeking = false;
    _settleUntil = Date.now() + settleMs;
    _seekRevision++;
  },

  /** True while the user's finger/mouse is down on the seekbar */
  get isSeeking() {
    return _isSeeking;
  },

  /** True during the brief window after release before the authoritative position arrives */
  get isSettling() {
    return Date.now() < _settleUntil;
  },

  /** True if remote position updates should be suppressed */
  get shouldBlockRemoteUpdate() {
    return _isSeeking || Date.now() < _settleUntil;
  },

  get revision() {
    return _seekRevision;
  },
};
