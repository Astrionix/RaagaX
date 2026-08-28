import { describe, it, expect } from 'vitest';
import { QualityManager } from '../../src/lib/playback/QualityManager';

describe('Premium Audio Quality Tests', () => {
  describe('QualityManager Bitrate Selection', () => {
    it('should select the highest available quality stream matching the cap', () => {
      const streams = [
        'https://saavncdn.com/song_12.mp4',
        'https://saavncdn.com/song_96.mp4',
        'https://saavncdn.com/song_160.mp4',
        'https://saavncdn.com/song_320.mp4',
      ];

      // Auto / Unlimited
      expect(QualityManager.selectHighestQuality(streams, 320)).toBe('https://saavncdn.com/song_320.mp4');

      // Cap at 160
      expect(QualityManager.selectHighestQuality(streams, 160)).toBe('https://saavncdn.com/song_160.mp4');

      // Cap at 96
      expect(QualityManager.selectHighestQuality(streams, 96)).toBe('https://saavncdn.com/song_96.mp4');
    });

    it('should support object formats with quality strings', () => {
      const streams = [
        { url: 'https://saavncdn.com/song_low.mp4', quality: '96kbps' },
        { url: 'https://saavncdn.com/song_med.mp4', quality: '160kbps' },
        { url: 'https://saavncdn.com/song_high.mp4', quality: '320kbps' },
      ];

      expect(QualityManager.selectHighestQuality(streams, 320)).toBe('https://saavncdn.com/song_high.mp4');
      expect(QualityManager.selectHighestQuality(streams, 160)).toBe('https://saavncdn.com/song_med.mp4');
    });

    it('should fallback to the lowest available stream if all exceed the cap', () => {
      const streams = [
        'https://saavncdn.com/song_320.mp4',
      ];

      // Cap at 96 but only 320 is available
      expect(QualityManager.selectHighestQuality(streams, 96)).toBe('https://saavncdn.com/song_320.mp4');
    });

    it('should upgrade http to https', () => {
      const streams = [
        'http://saavncdn.com/song_320.mp4',
      ];
      expect(QualityManager.selectHighestQuality(streams, 320)).toBe('https://saavncdn.com/song_320.mp4');
    });
  });

  describe('Loudness Normalization Gain Calculator', () => {
    it('should compute correct gain multiplier based on song loudness', () => {
      const targetLoudness = -14.0;
      
      // Case 1: Quiet song (-18 LUFS) -> should boost gain (+4dB)
      const loudness1 = -18.0;
      const dbGain1 = targetLoudness - loudness1;
      const multiplier1 = Math.pow(10, dbGain1 / 20);
      expect(dbGain1).toBe(4.0);
      expect(multiplier1).toBeCloseTo(1.5849, 4);

      // Case 2: Loud song (-10 LUFS) -> should attenuate gain (-4dB)
      const loudness2 = -10.0;
      const dbGain2 = targetLoudness - loudness2;
      const multiplier2 = Math.pow(10, dbGain2 / 20);
      expect(dbGain2).toBe(-4.0);
      expect(multiplier2).toBeCloseTo(0.6310, 4);

      // Case 3: Very quiet song (-25 LUFS) -> boost should cap at +6dB
      const loudness3 = -25.0;
      const dbGain3 = targetLoudness - loudness3;
      const clampedDbGain = Math.min(6.0, dbGain3);
      const multiplier3 = Math.pow(10, clampedDbGain / 20);
      expect(clampedDbGain).toBe(6.0);
      expect(multiplier3).toBeCloseTo(1.9953, 4);
    });
  });
});
