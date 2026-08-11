export interface TimelineAnchor {
  canonicalMs: number;
  mediaMs: number;
}

export interface TimelineMap {
  type: "offset" | "anchors";
  offsetMs?: number;
  anchors?: TimelineAnchor[];
}

export class MediaTimelineMapper {
  private timelineMap: TimelineMap;

  constructor(map?: TimelineMap) {
    this.timelineMap = map || { type: "offset", offsetMs: 0 };
  }

  public setTimelineMap(map: TimelineMap) {
    this.timelineMap = map;
  }

  public canonicalToMedia(canonicalMs: number): number {
    if (this.timelineMap.type === "offset") {
      return canonicalMs + (this.timelineMap.offsetMs || 0);
    }

    if (this.timelineMap.type === "anchors" && this.timelineMap.anchors && this.timelineMap.anchors.length > 0) {
      const anchors = this.timelineMap.anchors;
      if (anchors.length === 1) {
        return canonicalMs + (anchors[0].mediaMs - anchors[0].canonicalMs);
      }

      // Find the two anchors that surround the canonicalMs
      let lowerAnchor = anchors[0];
      let upperAnchor = anchors[anchors.length - 1];

      for (let i = 0; i < anchors.length - 1; i++) {
        if (canonicalMs >= anchors[i].canonicalMs && canonicalMs < anchors[i + 1].canonicalMs) {
          lowerAnchor = anchors[i];
          upperAnchor = anchors[i + 1];
          break;
        }
      }

      // If out of bounds below, extrapolate from the first anchor
      if (canonicalMs < anchors[0].canonicalMs) {
         return canonicalMs + (anchors[0].mediaMs - anchors[0].canonicalMs);
      }
      
      // If out of bounds above, extrapolate from the last anchor
      if (canonicalMs >= anchors[anchors.length - 1].canonicalMs) {
         return canonicalMs + (anchors[anchors.length - 1].mediaMs - anchors[anchors.length - 1].canonicalMs);
      }

      // Interpolate between the two anchors
      const canonicalDiff = upperAnchor.canonicalMs - lowerAnchor.canonicalMs;
      const mediaDiff = upperAnchor.mediaMs - lowerAnchor.mediaMs;
      
      if (canonicalDiff === 0) return lowerAnchor.mediaMs; // Prevent division by zero

      const ratio = (canonicalMs - lowerAnchor.canonicalMs) / canonicalDiff;
      return lowerAnchor.mediaMs + (mediaDiff * ratio);
    }

    return canonicalMs;
  }

  public mediaToCanonical(mediaMs: number): number {
    if (this.timelineMap.type === "offset") {
      return Math.max(0, mediaMs - (this.timelineMap.offsetMs || 0));
    }

    if (this.timelineMap.type === "anchors" && this.timelineMap.anchors && this.timelineMap.anchors.length > 0) {
      const anchors = this.timelineMap.anchors;
      if (anchors.length === 1) {
        return Math.max(0, mediaMs - (anchors[0].mediaMs - anchors[0].canonicalMs));
      }

      // Find the two anchors that surround the mediaMs
      let lowerAnchor = anchors[0];
      let upperAnchor = anchors[anchors.length - 1];

      for (let i = 0; i < anchors.length - 1; i++) {
        if (mediaMs >= anchors[i].mediaMs && mediaMs < anchors[i + 1].mediaMs) {
          lowerAnchor = anchors[i];
          upperAnchor = anchors[i + 1];
          break;
        }
      }

      // If out of bounds below, extrapolate
      if (mediaMs < anchors[0].mediaMs) {
         return Math.max(0, mediaMs - (anchors[0].mediaMs - anchors[0].canonicalMs));
      }
      
      // If out of bounds above, extrapolate
      if (mediaMs >= anchors[anchors.length - 1].mediaMs) {
         return Math.max(0, mediaMs - (anchors[anchors.length - 1].mediaMs - anchors[anchors.length - 1].canonicalMs));
      }

      // Interpolate between the two anchors
      const canonicalDiff = upperAnchor.canonicalMs - lowerAnchor.canonicalMs;
      const mediaDiff = upperAnchor.mediaMs - lowerAnchor.mediaMs;
      
      if (mediaDiff === 0) return lowerAnchor.canonicalMs; // Prevent division by zero

      const ratio = (mediaMs - lowerAnchor.mediaMs) / mediaDiff;
      return lowerAnchor.canonicalMs + (canonicalDiff * ratio);
    }

    return mediaMs;
  }
}
