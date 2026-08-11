export interface PlaybackClock {
  getMediaPositionMs(): number;
  getCanonicalPositionMs(): number;
  anchor(): void;
}
