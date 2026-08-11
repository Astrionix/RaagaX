import { describe, it, expect } from 'vitest';
import { MediaTimelineMapper, TimelineMap } from '../TimelineMapper';

describe('MediaTimelineMapper', () => {
  describe('offset mapping', () => {
    it('correctly adds offset for canonicalToMedia', () => {
      const map: TimelineMap = { type: 'offset', offsetMs: 12500 };
      const mapper = new MediaTimelineMapper(map);

      expect(mapper.canonicalToMedia(75000)).toBe(87500);
      expect(mapper.canonicalToMedia(0)).toBe(12500);
    });

    it('correctly subtracts offset for mediaToCanonical', () => {
      const map: TimelineMap = { type: 'offset', offsetMs: 12500 };
      const mapper = new MediaTimelineMapper(map);

      expect(mapper.mediaToCanonical(87500)).toBe(75000);
      expect(mapper.mediaToCanonical(12500)).toBe(0);
    });

    it('handles negative results by clamping to 0 for mediaToCanonical', () => {
      const map: TimelineMap = { type: 'offset', offsetMs: 12500 };
      const mapper = new MediaTimelineMapper(map);

      // If media is somehow before the offset, canonical should just clamp to 0
      expect(mapper.mediaToCanonical(5000)).toBe(0);
    });
  });

  describe('anchors mapping', () => {
    const anchorsMap: TimelineMap = {
      type: 'anchors',
      anchors: [
        { canonicalMs: 0, mediaMs: 12000 },
        { canonicalMs: 60000, mediaMs: 72000 },
        { canonicalMs: 120000, mediaMs: 134000 }
      ]
    };

    it('matches exact anchors for canonicalToMedia', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      expect(mapper.canonicalToMedia(0)).toBe(12000);
      expect(mapper.canonicalToMedia(60000)).toBe(72000);
      expect(mapper.canonicalToMedia(120000)).toBe(134000);
    });

    it('interpolates between anchors for canonicalToMedia', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      
      // Halfway between 0 and 60000
      // canonicalDiff = 60000, mediaDiff = 60000 -> 1:1 mapping
      // 30000 canonical -> 30000 + 12000 = 42000
      expect(mapper.canonicalToMedia(30000)).toBe(42000);

      // Halfway between 60000 and 120000
      // canonicalDiff = 60000, mediaDiff = 62000 (134000 - 72000)
      // 90000 canonical -> halfway -> 72000 + 31000 = 103000
      expect(mapper.canonicalToMedia(90000)).toBe(103000);
    });

    it('extrapolates before first anchor for canonicalToMedia', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      // canonical -10000 -> Should shift by first anchor's offset (12000)
      // -10000 + 12000 = 2000
      expect(mapper.canonicalToMedia(-10000)).toBe(2000);
    });

    it('extrapolates after last anchor for canonicalToMedia', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      // canonical 150000 -> Should shift by last anchor's offset (134000 - 120000 = 14000)
      // 150000 + 14000 = 164000
      expect(mapper.canonicalToMedia(150000)).toBe(164000);
    });

    it('matches exact anchors for mediaToCanonical', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      expect(mapper.mediaToCanonical(12000)).toBe(0);
      expect(mapper.mediaToCanonical(72000)).toBe(60000);
      expect(mapper.mediaToCanonical(134000)).toBe(120000);
    });

    it('interpolates between anchors for mediaToCanonical', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      
      expect(mapper.mediaToCanonical(42000)).toBe(30000);
      expect(mapper.mediaToCanonical(103000)).toBe(90000);
    });

    it('extrapolates before first anchor for mediaToCanonical', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      // media 5000 -> Shift by first anchor offset (-12000) -> -7000
      // Clamped to 0
      expect(mapper.mediaToCanonical(5000)).toBe(0);
    });

    it('extrapolates after last anchor for mediaToCanonical', () => {
      const mapper = new MediaTimelineMapper(anchorsMap);
      // media 164000 -> Shift by last anchor offset (-14000)
      // 164000 - 14000 = 150000
      expect(mapper.mediaToCanonical(164000)).toBe(150000);
    });
    
    it('handles single anchor correctly', () => {
      const singleAnchorMap: TimelineMap = {
        type: 'anchors',
        anchors: [{ canonicalMs: 1000, mediaMs: 5000 }]
      };
      const mapper = new MediaTimelineMapper(singleAnchorMap);
      
      expect(mapper.canonicalToMedia(2000)).toBe(6000);
      expect(mapper.mediaToCanonical(6000)).toBe(2000);
    });
  });
});
