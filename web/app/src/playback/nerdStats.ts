import type { AudioQualitySetting } from '@/state/desktopSettings';

export interface NerdStatsSnapshot {
  mimeType: string;
  codec: string;
  bitDepth: number | null;
  sampleRateHz: number | null;
  bitrateKbps: number | null;
  channels: number;
  sourceName?: string;
  isLossless: boolean;
  isHiRes: boolean;
  isHiQuality: boolean;
  isMediumQuality: boolean;
  isLowQuality: boolean;
  tierLabel: string;
}

export function parseNerdStats(streamInfo: string | null | undefined, qualitySetting?: AudioQualitySetting): NerdStatsSnapshot {
  const info = streamInfo ?? '';
  const lower = info.toLowerCase();

  let codec = 'Opus';
  let mimeType = 'audio/opus';
  let bitDepth: number | null = null;
  let sampleRateHz: number | null = 48000;
  let bitrateKbps: number | null = 160;
  let channels = 2;
  let sourceName = 'YouTube Music';

  if (lower.includes('flac')) {
    codec = 'FLAC';
    mimeType = 'audio/flac';
    bitDepth = lower.includes('24-bit') || lower.includes('24bit') || lower.includes('96') ? 24 : 16;
    sampleRateHz = lower.includes('96') ? 96000 : lower.includes('192') ? 192000 : 44100;
    bitrateKbps = bitDepth === 24 ? 921 : 705;
    sourceName = 'Lossless Source';
  } else if (lower.includes('alac')) {
    codec = 'ALAC';
    mimeType = 'audio/alac';
    bitDepth = 24;
    sampleRateHz = 48000;
    bitrateKbps = 850;
  } else if (lower.includes('aac') || lower.includes('140') || lower.includes('mp4a')) {
    codec = 'AAC';
    mimeType = 'audio/mp4a-latm';
    bitDepth = 16;
    sampleRateHz = 44100;
    bitrateKbps = lower.includes('320') ? 320 : lower.includes('256') ? 256 : 128;
  } else if (lower.includes('mp3') || lower.includes('mpeg')) {
    codec = 'MP3';
    mimeType = 'audio/mpeg';
    sampleRateHz = 44100;
    bitrateKbps = 320;
  } else if (lower.includes('pcm') || lower.includes('raw') || lower.includes('wav')) {
    codec = 'PCM';
    mimeType = 'audio/raw';
    bitDepth = 16;
    sampleRateHz = 44100;
    bitrateKbps = 1411;
  } else if (lower.includes('opus') || lower.includes('251')) {
    codec = 'Opus';
    mimeType = 'audio/opus';
    sampleRateHz = 48000;
    bitrateKbps = 160;
  }

  // Extract bitrate if explicitly present like "140kbps" or "320 kbps"
  const kbpsMatch = info.match(/(\d+)\s*kbps/i);
  if (kbpsMatch && kbpsMatch[1]) {
    bitrateKbps = parseInt(kbpsMatch[1], 10);
  }

  // Extract sample rate if explicitly present like "44100Hz" or "96000" or "48kHz"
  const hzMatch = info.match(/(\d+)\s*(?:khz|hz)/i);
  if (hzMatch && hzMatch[1]) {
    const rawVal = parseFloat(hzMatch[1]);
    sampleRateHz = rawVal < 1000 ? Math.round(rawVal * 1000) : Math.round(rawVal);
  }

  // Extract source client if present
  if (info.includes('via ')) {
    sourceName = info.split('via ')[1]?.trim() || sourceName;
  }

  // Fallbacks if setting is lossless and no stream info
  if (!streamInfo && qualitySetting === 'lossless') {
    codec = 'FLAC';
    mimeType = 'audio/flac';
    bitDepth = 24;
    sampleRateHz = 48000;
    bitrateKbps = 921;
    sourceName = 'Hi-Fi Source';
  } else if (!streamInfo && qualitySetting === 'high') {
    codec = 'AAC';
    mimeType = 'audio/mp4a-latm';
    sampleRateHz = 44100;
    bitrateKbps = 320;
  } else if (!streamInfo && qualitySetting === 'low') {
    codec = 'Opus';
    mimeType = 'audio/opus';
    sampleRateHz = 48000;
    bitrateKbps = 70;
  }

  const isLossless = codec === 'FLAC' || codec === 'ALAC' || codec === 'PCM';
  const isHiRes = isLossless && ((bitDepth ?? 0) > 16 || (sampleRateHz ?? 0) > 48000);
  const isHiQuality = !isLossless && (bitrateKbps ?? 0) >= 256;
  const isMediumQuality = !isLossless && (bitrateKbps ?? 0) > 80 && (bitrateKbps ?? 0) < 256;
  const isLowQuality = !isLossless && (bitrateKbps ?? 0) <= 80;

  let tierLabel = 'Opus 160 kbps';
  if (isHiRes) {
    tierLabel = 'Hi-Res Lossless';
  } else if (isLossless) {
    tierLabel = 'Lossless';
  } else if (isHiQuality) {
    tierLabel = 'High Quality';
  } else if (isMediumQuality) {
    tierLabel = 'Medium Quality';
  } else if (isLowQuality) {
    tierLabel = 'Data Saver';
  }

  return {
    mimeType,
    codec,
    bitDepth,
    sampleRateHz,
    bitrateKbps,
    channels,
    sourceName,
    isLossless,
    isHiRes,
    isHiQuality,
    isMediumQuality,
    isLowQuality,
    tierLabel,
  };
}

/**
 * Format string exactly as desktop app's NerdStats.Snapshot.describe() does:
 * e.g. "FLAC · 24-bit · 96.0 kHz · 921 kbps · Stereo"
 * or "Opus · 48.0 kHz · 160 kbps · Stereo"
 */
export function describeNerdStats(snapshot: NerdStatsSnapshot): string {
  const parts: string[] = [];
  if (snapshot.codec) parts.push(snapshot.codec);
  if (snapshot.bitDepth) parts.push(`${snapshot.bitDepth}-bit`);
  if (snapshot.sampleRateHz) {
    const khz = (snapshot.sampleRateHz / 1000).toFixed(1);
    parts.push(`${khz} kHz`);
  }
  if (snapshot.bitrateKbps) parts.push(`${snapshot.bitrateKbps} kbps`);
  parts.push(snapshot.channels === 1 ? 'Mono' : 'Stereo');
  return parts.join(' · ');
}

/**
 * Compact line for LCD or badges:
 * e.g. "FLAC 24-bit/96kHz" or "Opus 160kbps"
 */
export function shortNerdStats(snapshot: NerdStatsSnapshot): string {
  if (snapshot.isLossless) {
    const rate = snapshot.sampleRateHz ? `${Math.round(snapshot.sampleRateHz / 1000)}kHz` : '';
    const depth = snapshot.bitDepth ? `${snapshot.bitDepth}-bit/` : '';
    return `${snapshot.codec} ${depth}${rate}`.trim();
  }
  return `${snapshot.codec} ${snapshot.bitrateKbps ?? 160}kbps`;
}
